import { FastMCP } from "fastmcp";
import { z } from "zod";
import { fetchFMCSA, SAFER_BASE_URL, LI_PUBLIC_BASE_LIVIEW_URL } from "./fmcsaClient.js";
import { FMCSAResponseParser } from "./fmcsaResponseParser.js";

const server = new FastMCP({
  name: "FMCSA",
  version: "1.0.0",
});

function parseCompanyNumber(number: string): { queryParam: string; cleanNumber: string } {
  let queryParam = "USDOT";
  let cleanNumber = number.trim().replace(/[-_]/g, '');
  const upperNumber = cleanNumber.toUpperCase();

  if (upperNumber.startsWith("MC")) {
    queryParam = "MC_MX";
    cleanNumber = upperNumber.substring(2);
  } else if (upperNumber.startsWith("MX")) {
    queryParam = "MC_MX";
    cleanNumber = upperNumber.substring(2);
  } else if (upperNumber.startsWith("DOT") || upperNumber.startsWith("USDOT")) {
    queryParam = "USDOT";
    cleanNumber = upperNumber.startsWith("USDOT") ? upperNumber.substring(5) : upperNumber.substring(3);
  } else {
    cleanNumber = upperNumber;
  }

  return { queryParam, cleanNumber };
}

server.addTool({
  name: "getCompany",
  description: "Get company information from FMCSA by USDOT, MC or MX number. Example: 1234567, 7123456, MC-123456, MX-123456",
  parameters: z.object({
    number: z.string(),
  }),
  execute: async (args) => {
    const { number } = args;
    const { queryParam, cleanNumber } = parseCompanyNumber(number);

    const url = `${SAFER_BASE_URL}/query.asp?searchtype=ANY&query_type=queryCarrierSnapshot&query_param=${queryParam}&query_string=${cleanNumber}`;

    let data = await fetchFMCSA(url);
    const parser = new FMCSAResponseParser(data);
    await parser.waitReady();
    const result = parser.parseCompanySnapshot();

    return result || "No data found";
  }
});

server.addTool({
  name: "findCompanyByName",
  description: "Find company information from FMCSA by company name",
  parameters: z.object({
    name: z.string(),
  }),
  execute: async (args) => {
    const { name } = args;
    const params = new URLSearchParams({
      searchtype: '',
      searchstring: name
    });
    const url = `${SAFER_BASE_URL}/keywordx.asp?${params}`;
    const searchData = await fetchFMCSA(url);

    const searchParser = new FMCSAResponseParser(searchData);
    await searchParser.waitReady();
    const companyLink = searchParser.extractLinkByText(name);

    if (!companyLink) {
      return "Company not found";
    }
    const companyData = await fetchFMCSA(SAFER_BASE_URL + '/' + companyLink);
    const companyParser = new FMCSAResponseParser(companyData);
    await companyParser.waitReady();
    const result = companyParser.parseCompanySnapshot();

    return result || "No data found";
  }
});

const HISTORY_ACTIONS = [
  'pkg_carrquery.prc_insurancehistory',
  'pkg_carrquery.prc_activeinsurance',
  'pkg_carrquery.prc_rejectinsurance',
  'pkg_carrquery.prc_authorityhistory',
  'pkg_carrquery.prc_pendapplication',
  'pkg_carrquery.prc_revocation'
] as const;

const CARRIER_DETAILS_ACTION = 'pkg_carrquery.prc_getdetail';
const TABLE_SELECTOR = 'table[width="100%"][border="4"]';
const REQUEST_DELAY_MS = 1000;

function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function fetchAndParseTable(
  action: string,
  formData: Record<string, string>,
  token: string | undefined,
  tableOffset: number = 0
): Promise<string | null> {
  const url = `${LI_PUBLIC_BASE_LIVIEW_URL}${action}`;
  const response = await fetchFMCSA(url, "POST", formData, token);
  const parser = new FMCSAResponseParser(response);
  if (parser.isRecaptchaOnPage()) {
    throw new Error(`reCAPTCHA detected at ${url}`);
  }
  await parser.waitReady();
  return parser.tableToMarkdown(TABLE_SELECTOR, tableOffset);
}

server.addTool({
  name: "getCompanyHistory",
  description: "Get company licensing and insurance history from FMCSA by USDOT, MC or MX number",
  parameters: z.object({
    number: z.string(),
    token: z.string().optional(),
  }),
  execute: async (args) => {
    const { number, token } = args;
    const { queryParam, cleanNumber } = parseCompanyNumber(number);

    // Step 1: Get company snapshot
    const snapshotUrl = `${SAFER_BASE_URL}/query.asp?searchtype=ANY&query_type=queryCarrierSnapshot&query_param=${queryParam}&query_string=${cleanNumber}`;
    const snapshotResponse = await fetchFMCSA(snapshotUrl);
    const snapshotParser = new FMCSAResponseParser(snapshotResponse);
    const licensingLink = snapshotParser.extractLicensingInsuranceLink();

    if (!licensingLink) {
      return JSON.stringify({ error: "Licensing & Insurance link not found in response" });
    }

    // Step 2: Get licensing page with form
    const licensingResponse = await fetchFMCSA(licensingLink, "GET", undefined, token);
    const licensingParser = new FMCSAResponseParser(licensingResponse);

    if (licensingParser.isRecaptchaOnPage()) {
      return `Error: reCAPTCHA detected. Please provide valid token. [GET] ${licensingLink}`;
    }

    // Step 3: Get carrier details
    await licensingParser.waitReady();
    const carrierDetailsUrl = `${LI_PUBLIC_BASE_LIVIEW_URL}${CARRIER_DETAILS_ACTION}`;
    const carrierDetailsFormData = licensingParser.getSearchFormData(CARRIER_DETAILS_ACTION);
    const carrierDetailsResponse = await fetchFMCSA(carrierDetailsUrl, "POST", carrierDetailsFormData, token);
    const carrierDetailsParser = new FMCSAResponseParser(carrierDetailsResponse);

    if (carrierDetailsParser.isRecaptchaOnPage()) {
      return `Error: reCAPTCHA detected. Please provide valid token. [POST] ${carrierDetailsUrl}`;
    }
    await carrierDetailsParser.waitReady();

    // Step 4: Get additional history sections from carrier details page
    let markdown = carrierDetailsParser.tableToMarkdown(TABLE_SELECTOR) || '';

    for (const action of HISTORY_ACTIONS) {
      // await sleep(REQUEST_DELAY_MS);
      try {
        const formData = carrierDetailsParser.getSearchFormData(action);

        if (Object.keys(formData).length === 0) {
          console.error(`No form found for ${action}, skipping...${action}`);
          continue;
        }

        const actionMarkdown = await fetchAndParseTable(action, formData, token, 1);
        if (actionMarkdown) {
          markdown += '\n\n' + actionMarkdown;
        }
      } catch (error) {
        console.error(error);
      }
    }

    return markdown || "No table found";
  }
});

server.start({
  transportType: "stdio",
});