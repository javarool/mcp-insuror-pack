export const SAFER_BASE_URL = "https://safer.fmcsa.dot.gov";
export const LI_PUBLIC_BASE_URL = "https://li-public.fmcsa.dot.gov";
export const LI_PUBLIC_BASE_LIVIEW_URL = "https://li-public.fmcsa.dot.gov/LIVIEW/";

export async function fetchFMCSA(
  url: string,
  method: "GET" | "POST" = "POST",
  formData?: Record<string, string>,
  token?: string
): Promise<string> {

  if (url.startsWith("http://")) {
    url = url.replace("http://", "https://");
  }

  const headers: Record<string, string> = {
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
    "Accept-Encoding": "gzip"
  };

  if (token) {
    headers["Cookie"] = `LI_search=${token}`;
    // headers["Cookie"] = token;
  }

  let body: string | undefined;
  if (formData && method === "POST") {
    const params = new URLSearchParams(formData);
    body = params.toString();
    headers["Content-Type"] = "application/x-www-form-urlencoded";
  }

  // const startTime = Date.now();
  // console.error(`[${method}] ${url}`);
  // if (body) {
  //   console.error('Body:', body);
  // }

  const response = await fetch(url, {
    method,
    headers,
    body
  });

  // const duration = Date.now() - startTime;
  // console.error(`Response status: ${response.status} (${duration}ms)`);

  return await response.text();
}
// https://li-public.fmcsa.dot.gov/LIVIEW/pkg_carrquery.prc_carrlist?n_dotno=2870261&s_prefix=MC&n_docketno=&s_legalname=&s_dbaname=&s_state=
// <form action="pkg_carrquery.prc_getdetail" method="POST">
// <input type="hidden" name="pv_apcant_id" value="883173">
// <input type="hidden" name="pv_vpath" value="LIVIEW">
// <input type="submit" value="HTML" onclick="">
//     </form>
