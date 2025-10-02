import * as cheerio from "cheerio";
import { BaseTableParser } from "./baseTableParser.js";

// Extend Cheerio interface to include parsetable method from cheerio-tableparser
declare module "cheerio" {
  interface Cheerio<T> {
    parsetable(dupCols?: boolean, dupRows?: boolean, textMode?: boolean): string[][];
  }
}

/**
 * FMCSA-specific HTML parser for company snapshot pages.
 * Uses BaseTableParser for universal table operations.
 */
export class FMCSAResponseParser {
  private $: cheerio.CheerioAPI;
  private readonly ready: Promise<void>;
  private baseParser: BaseTableParser;

  constructor(html: string) {
    this.$ = cheerio.load(html);
    this.baseParser = new BaseTableParser(html);

    const $instance = this.$;
    this.ready = (async () => {
      // @ts-ignore - cheerio-tableparser has no types
      const cheerioTableparser = (await import("cheerio-tableparser")).default;
      cheerioTableparser($instance);
    })();
  }

  async waitReady(): Promise<void> {
    await this.ready;
  }

  private static readonly LICENSING_INSURANCE_TEXT = "Licensing & Insurance";

  /**
   * Extracts a link by its text content.
   * Used by: getCompany tool to fetch additional insurance details, findCompanyByName to get company link
   * @param linkText Text to search for in link (default: "Licensing & Insurance")
   * @returns URL string or null if not found
   */
  extractLinkByText(linkText: string): string | null {
    const link = this.$(`a:contains("${linkText}")`).attr("href");
    if (!link) {
      return null;
    }

    return link;
  }

  /**
   * Extracts the "Licensing & Insurance" link from the page.
   * Used by: getCompany tool to fetch additional insurance details
   * @returns URL string or null if not found
   */
  extractLicensingInsuranceLink(): string | null {
    return this.extractLinkByText(FMCSAResponseParser.LICENSING_INSURANCE_TEXT);
  }

  getSearchFormData(actionText: string): Record<string, string> {
    const form = this.$(`form[action="${actionText}"]`);
    const formData: Record<string, string> = {};

    form.find('input[type="hidden"]').each((_: number, input: any) => {
      const name = this.$(input).attr('name');
      const value = this.$(input).attr('value');
      if (name && value) {
        formData[name] = value;
      }
    });

    return formData;
  }

  /**
   * Checks if reCAPTCHA is present on the page.
   * Used by: All tools to detect bot protection
   * @returns True if reCAPTCHA detected
   */
  isRecaptchaOnPage(): boolean {
    if (this.$('.g-recaptcha').length > 0) {
      return true;
    }

    if (this.$('script[src*="recaptcha"]').length > 0) {
      return true;
    }

    if (this.$('input[name="g_recaptcha_response"]').length > 0) {
      return true;
    }

    return false;
  }

  /**
   * Generic table to Markdown converter.
   * Used by: Various tools for Markdown table output format
   * @param selector Optional CSS selector to target specific table
   * @param offset Number of tables to skip from the beginning (default: 0)
   * @returns Markdown table string or null if no tables found
   */
  tableToMarkdown(selector?: string, offset: number = 0): string | null {
    let tables;

    if (selector) {
      tables = this.$(selector);
    } else {
      tables = this.$('table');
    }

    if (tables.length === 0) {
      return null;
    }

    const allRows: string[][] = [];

    tables.each((tableIndex: number, table: any) => {
      if (tableIndex < offset) {
        return;
      }

      const rows: string[][] = [];

      this.$(table).find('tr').each((_: number, row: any) => {
        const cells: string[] = [];
        this.$(row).find('td, th').each((_: number, cell: any) => {
          let text = this.$(cell).text().trim();
          text = text.replace(/\s+/g, ' ');
          cells.push(text);

          const colspan = parseInt(this.$(cell).attr('colspan') || '1', 10);
          for (let i = 1; i < colspan; i++) {
            cells.push('');
          }
        });
        if (cells.length > 0) {
          rows.push(cells);
        }
      });

      if (rows.length > 0) {
        allRows.push(...rows);
        if (tableIndex < tables.length - 1) {
          allRows.push([]);
        }
      }
    });

    if (allRows.length === 0) {
      return null;
    }

    return this.arrayToMarkdownTable(allRows);
  }

  /**
   * Generic table to CSV converter.
   * Used by: Various tools for CSV output format
   * @param selector Optional CSS selector to target specific table
   * @returns CSV string or null if no tables found
   * @deprecated Use tableToMarkdown instead
   */
  tableToCSV(selector?: string): string | null {
    let tables;

    if (selector) {
      tables = this.$(selector);
    } else {
      tables = this.$('table');
    }

    if (tables.length === 0) {
      return null;
    }

    const allRows: string[][] = [];

    tables.each((tableIndex: number, table: any) => {
      const rows: string[][] = [];

      this.$(table).find('tr').each((_: number, row: any) => {
        const cells: string[] = [];
        this.$(row).find('td, th').each((_: number, cell: any) => {
          let text = this.$(cell).text().trim();
          text = text.replace(/\s+/g, ' ');
          text = text.replace(/"/g, '""');
          cells.push(`"${text}"`);

          const colspan = parseInt(this.$(cell).attr('colspan') || '1', 10);
          for (let i = 1; i < colspan; i++) {
            cells.push('""');
          }
        });
        if (cells.length > 0) {
          rows.push(cells);
        }
      });

      if (rows.length > 0) {
        allRows.push(...rows);
        if (tableIndex < tables.length - 1) {
          allRows.push([]);
        }
      }
    });

    if (allRows.length === 0) {
      return null;
    }

    return allRows.map(row => row.join(',')).join('\n');
  }

  private extractCheckedItems(parentElement: any): string[] {
    const items: string[] = [];

    parentElement.find('table').each((_: number, table: any) => {
      this.$(table).find('tr').each((_: number, row: any) => {
        const cells = this.$(row).find('td');
        if (cells.length >= 2) {
          const firstCell = this.$(cells[0]).text().trim();
          const secondCell = this.$(cells[1]).text().trim();

          if (firstCell === 'X' && secondCell) {
            items.push(secondCell);
          }
        }
      });
    });

    return items;
  }

  private tableToCSVRows(table: any, skipNestedTables: boolean = false): string[][] {
    const rows: string[][] = [];

    table.find('tr').each((_: number, row: any) => {
      if (skipNestedTables && this.$(row).find('table').length > 0) {
        return;
      }

      const cells: string[] = [];
      this.$(row).find('td, th').each((_: number, cell: any) => {
        if (skipNestedTables && this.$(cell).find('table').length > 0) {
          return;
        }

        let text = this.$(cell).text().trim();
        text = text.replace(/\s+/g, ' ');
        text = text.replace(/"/g, '""');
        cells.push(`"${text}"`);

        const colspan = parseInt(this.$(cell).attr('colspan') || '1', 10);
        for (let i = 1; i < colspan; i++) {
          cells.push('""');
        }
      });

      if (cells.length > 0) {
        rows.push(cells);
      }
    });

    return rows;
  }

  /**
   * Extracts the USDOT INFORMATION section from company snapshot.
   * This includes: Entity Type, USDOT Status, USDOT Number, MCS-150 Form Date,
   * Operating Authority Status, MC/MX/FF Numbers, Legal Name, DBA Name,
   * Physical Address, Phone, Mailing Address, DUNS Number, Power Units/Drivers.
   * Used by: parseCompanySnapshot
   * @returns Markdown table with USDOT info
   */
  extractUSDOTSection(): string {
    const table = this.$('table[border="1"][width="70%"][bordercolor="SILVER"]').first();
    if (table.length === 0) {
      return 'No table found';
    }

    const rows: string[][] = [];
    let insideMainSection = false;

    table.find('tr').each((_: number, row: any) => {
      const $row = this.$(row);

      // Handle rows with nested tables
      if ($row.find('table').length > 0) {
        const cells = $row.children('td, th');
        if (cells.length === 0) return;

        const firstCell = this.getVisibleText(this.$(cells[0]));

        // Stop at these sections
        if (firstCell.includes('Operation Classification') ||
            firstCell.includes('Carrier Operation') ||
            firstCell.includes('Cargo Carried')) {
          insideMainSection = false;
          return;
        }

        // For Power Units row, extract direct children cells (includes nested table content)
        if (insideMainSection) {
          const cellData: string[] = [];
          cells.each((_: number, cell: any) => {
            const text = this.getVisibleText(cell);
            if (text) {
              cellData.push(text);
            }
          });

          if (cellData.length > 0 && !cellData.every(c => !c)) {
            rows.push(cellData);
          }
        }
        return;
      }

      const cells = $row.find('td, th');
      if (cells.length === 0) {
        return;
      }

      const firstCell = this.getVisibleText(this.$(cells[0]));

      if (firstCell === 'USDOT INFORMATION') {
        insideMainSection = true;
        return;
      }

      // Stop at nested table sections
      if (firstCell.includes('Operation Classification:') ||
          firstCell.includes('Carrier Operation:') ||
          firstCell.includes('Cargo Carried:')) {
        insideMainSection = false;
        return;
      }

      // Skip rows that are part of nested table content (already extracted above)
      if (firstCell.includes('Non-CMV Units:')) {
        return;
      }

      if (!insideMainSection) {
        return;
      }

      // Extract cells (limit to 4 columns for USDOT section)
      const cellData: string[] = [];
      cells.each((_: number, cell: any) => {
        if (cellData.length >= 4) return; // Only take first 4 columns

        const text = this.getVisibleText(cell);
        cellData.push(text);
      });

      // Skip completely empty rows
      if (cellData.every(cell => !cell)) {
        return;
      }

      rows.push(cellData);
    });

    return this.arrayToMarkdownTable(rows);
  }

  private getVisibleText(element: any): string {
    const clone = this.$(element).clone();
    clone.find('.hidden').remove();
    return clone.text().trim().replace(/\s+/g, ' ');
  }

  private arrayToMarkdownTable(data: string[][]): string {
    if (!data || data.length === 0) {
      return '';
    }

    const rows = data.map(row => '| ' + row.map(cell => cell.trim()).join(' | ') + ' |');
    return rows.join('\n');
  }

  /**
   * Extracts checked "Operation Classification" items (Auth. For Hire, Private, etc).
   * Used by: parseCompanySnapshot
   * @returns Markdown row with section title and comma-separated values
   */
  extractOperationClassification(): string {
    return this.extractCheckedItemsFromSection('Operation Classification');
  }

  /**
   * Extracts checked "Carrier Operation" items (Interstate, Intrastate, etc).
   * Used by: parseCompanySnapshot
   * @returns Markdown row with section title and comma-separated values
   */
  extractCarrierOperation(): string {
    return this.extractCheckedItemsFromSection('Carrier Operation');
  }

  /**
   * Extracts checked "Cargo Carried" items (General Freight, Refrigerated Food, etc).
   * Used by: parseCompanySnapshot
   * @returns Markdown row with section title and comma-separated values
   */
  extractCargoCarried(): string {
    return this.extractCheckedItemsFromSection('Cargo Carried');
  }

  /**
   * Extracts US inspection statistics table.
   * Includes: Inspection counts, Out of Service counts/percentages by type.
   * Used by: parseCompanySnapshot
   * @returns Markdown table with inspection data
   */
  extractUSInspectionSection(): string {
    return this.baseParser['extractTableBySelector']('table[summary="Inspections"]', 1, 0);
  }

  /**
   * Extracts US crashes table.
   * Includes: Fatal, Injury, Tow, and Total crash counts.
   * Used by: parseCompanySnapshot
   * @returns Markdown table with crash data
   */
  extractCrashesSection(): string {
    return this.baseParser['extractTableBySelector']('table[summary="Crashes"]', 1, 0);
  }

  /**
   * Extracts Canadian inspection statistics table (second inspection table).
   * Includes: Inspection counts, Out of Service counts/percentages by type.
   * Used by: parseCompanySnapshot
   * @returns Markdown table with Canadian inspection data
   */
  extractCanadianInspectionSection(): string {
    return this.baseParser['extractTableBySelector']('table[summary="Inspections"]', 2, 1);
  }

  /**
   * Extracts Canadian crashes table (second crash table).
   * Includes: Fatal, Injury, Tow, and Total crash counts.
   * Used by: parseCompanySnapshot
   * @returns Markdown table with Canadian crash data
   */
  extractCanadianCrashesSection(): string {
    return this.baseParser['extractTableBySelector']('table[summary="Crashes"]', 2, 1);
  }

  /**
   * Extracts safety rating and review information.
   * Includes: Rating Date, Review Date, Rating, Review Type.
   * Used by: parseCompanySnapshot
   * @returns Markdown table with safety rating data
   */
  extractSafetyRatingSection(): string {
    return this.baseParser['extractTableBySelector']('table[summary="Review Information"]', 1, 0);
  }

  /**
   * FMCSA-specific extraction of checked items from nested tables.
   * Looks for sections in main FMCSA table and extracts items marked with 'X'.
   * @param sectionTitle Title of the section to extract (e.g., "Cargo Carried")
   * @returns Markdown row with section title and comma-separated values
   */
  private extractCheckedItemsFromSection(sectionTitle: string): string {
    const mainTableSelector = 'table[border="1"][width="70%"][bordercolor="SILVER"]';
    const items = new Set<string>();
    const table = this.$(mainTableSelector).first();

    let captureNext = false;

    table.find('tr').each((_: number, row: any) => {
      const $row = this.$(row);
      const tdText = $row.find('td').first().text().trim();

      if (tdText.includes(sectionTitle)) {
        captureNext = true;
        return;
      }

      if (captureNext && (tdText.includes('Operation Classification') ||
          tdText.includes('Carrier Operation') ||
          tdText.includes('Cargo Carried'))) {
        if (!tdText.includes(sectionTitle)) {
          captureNext = false;
          return;
        }
      }

      if (captureNext && $row.find('table').length > 0) {
        $row.find('table').each((_: number, nestedTable: any) => {
          this.$(nestedTable).find('tr').each((_: number, nestedRow: any) => {
            const cells = this.$(nestedRow).find('td');
            if (cells.length >= 2) {
              const firstCell = this.$(cells[0]).text().trim();
              const secondCell = this.$(cells[1]).text().trim();
              if (firstCell === 'X' && secondCell && !secondCell.includes('SAFER')) {
                items.add(secondCell);
              }
            }
          });
        });
        captureNext = false;
      }
    });

    if (items.size === 0) {
      return '';
    }

    return '| ' + sectionTitle + ': | ' + Array.from(items).join(', ') + ' |';
  }

  /**
   * Main orchestration method that extracts all sections from company snapshot page.
   * Combines: USDOT Info, Operation Classification, Carrier Operation, Cargo Carried,
   * US Inspections, US Crashes, Canadian Inspections, Canadian Crashes, Safety Rating.
   * Used by: getCompany tool to return complete company snapshot
   * @returns Full Markdown report with all sections separated by blank lines
   */
  parseCompanySnapshot(): string {
    const sections: string[] = [];

    const usdotInfo = this.extractUSDOTSection();
    if (usdotInfo) {
      sections.push(usdotInfo);
    }

    const operationClass = this.extractOperationClassification();
    if (operationClass) {
      sections.push(operationClass);
    }

    const carrierOp = this.extractCarrierOperation();
    if (carrierOp) {
      sections.push(carrierOp);
    }

    const cargo = this.extractCargoCarried();
    if (cargo) {
      sections.push(cargo);
    }

    const usInspections = this.extractUSInspectionSection();
    if (usInspections) {
      sections.push(usInspections);
    }

    const usCrashes = this.extractCrashesSection();
    if (usCrashes) {
      sections.push(usCrashes);
    }

    const canadianInspections = this.extractCanadianInspectionSection();
    if (canadianInspections) {
      sections.push(canadianInspections);
    }

    const canadianCrashes = this.extractCanadianCrashesSection();
    if (canadianCrashes) {
      sections.push(canadianCrashes);
    }

    const safetyRating = this.extractSafetyRatingSection();
    if (safetyRating) {
      sections.push(safetyRating);
    }

    return sections.filter(s => s.length > 0).join('\n\n');
  }
}