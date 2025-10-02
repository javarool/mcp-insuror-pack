import * as cheerio from "cheerio";

/**
 * Universal HTML table parser with no domain-specific knowledge.
 * Handles extraction of tables, hidden elements filtering, and markdown conversion.
 */
export class BaseTableParser {
  protected $: cheerio.CheerioAPI;

  constructor(html: string) {
    this.$ = cheerio.load(html);
  }

  /**
   * Extracts visible text from an element, excluding elements with .hidden class.
   * @param element - Cheerio element to extract text from
   * @returns Cleaned and trimmed text content
   */
  protected getVisibleText(element: any): string {
    const clone = this.$(element).clone();
    clone.find('.hidden').remove();
    return clone.text().trim().replace(/\s+/g, ' ');
  }

  /**
   * Converts 2D array of strings to Markdown table format.
   * @param data - Array of rows, each row is an array of cell values
   * @returns Markdown formatted table string
   */
  protected arrayToMarkdownTable(data: string[][]): string {
    if (!data || data.length === 0) {
      return '';
    }

    const rows = data.map(row => '| ' + row.map(cell => cell.trim()).join(' | ') + ' |');
    return rows.join('\n');
  }

  /**
   * Extracts table data by CSS selector.
   * Automatically filters hidden elements and avoids nested tables.
   * @param selector - CSS selector to find the table
   * @param maxTables - Not used, kept for compatibility
   * @param tableIndex - Index of table if multiple tables match selector (0-based)
   * @returns Markdown formatted table or empty string if not found
   */
  protected extractTableBySelector(selector: string, maxTables: number = 1, tableIndex: number = 0): string {
    const tables = this.$(selector);
    if (tables.length <= tableIndex) {
      return '';
    }

    const targetTable = this.$(tables[tableIndex]);
    const rows: string[][] = [];

    const tableRows = targetTable.children('tbody').length > 0
      ? targetTable.children('tbody').children('tr')
      : targetTable.children('tr');

    tableRows.each((_: number, row: any) => {
      const cells: string[] = [];
      this.$(row).children('td, th').each((_: number, cell: any) => {
        const text = this.getVisibleText(cell);
        cells.push(text);
      });

      if (cells.length > 0 && cells.some(c => c)) {
        rows.push(cells);
      }
    });

    return this.arrayToMarkdownTable(rows);
  }

  /**
   * Extracts items marked with "X" from a section with nested tables.
   * Generic method that works with any checklist-style HTML structure.
   * @param sectionTitle - Title of the section to search for
   * @param mainTableSelector - CSS selector for the main table containing the section
   * @returns Markdown formatted row with section title and comma-separated values
   */
  protected extractCheckedItemsFromSection(sectionTitle: string, mainTableSelector: string): string {
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
}
