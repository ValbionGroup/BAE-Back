/*
 * Copyright (c) 2026 - Groupe Valbion - Tous droits réservés.
 */

import puppeteer, { type Browser } from 'puppeteer'
import { readFile } from 'node:fs/promises'
import { join } from 'node:path'

export default class PdfService {
  private browser: Browser | null = null

  /**
   * Initialize Puppeteer browser instance
   */
  private async getBrowser(): Promise<Browser> {
    if (!this.browser) {
      this.browser = await puppeteer.launch({
        headless: true,
        args: ['--no-sandbox', '--disable-setuid-sandbox'],
      })
    }
    return this.browser
  }

  /**
   * Close the browser instance
   */
  async closeBrowser(): Promise<void> {
    if (this.browser) {
      await this.browser.close()
      this.browser = null
    }
  }

  /**
   * Simple template engine - replaces {{variable}} with values from data
   */
  private compileTemplate(template: string, data: Record<string, any>): string {
    return template.replace(/\{\{([^}]+)\}\}/g, (_, key) => {
      const trimmedKey = key.trim()
      return data[trimmedKey] !== undefined ? String(data[trimmedKey]) : ''
    })
  }

  /**
   * Generate PDF from HTML template file
   * @param templatePath - Path to HTML template file (relative to resources/views/pdfs/)
   * @param data - Data to inject into template
   * @param options - PDF generation options
   */
  async generateFromTemplate(
    templatePath: string,
    data: Record<string, any>,
    options: {
      format?: 'A4' | 'Letter'
      landscape?: boolean
      margin?: { top?: string; right?: string; bottom?: string; left?: string }
      displayHeaderFooter?: boolean
      headerTemplate?: string
      footerTemplate?: string
    } = {}
  ): Promise<Buffer> {
    const browser = await this.getBrowser()
    const page = await browser.newPage()

    try {
      // Read template file
      const fullPath = join(process.cwd(), 'resources/views/pdfs', templatePath)
      const templateContent = await readFile(fullPath, 'utf-8')

      // Compile template with data
      const compiledHtml = this.compileTemplate(templateContent, data)

      // Set content and generate PDF
      await page.setContent(compiledHtml, {
        waitUntil: 'networkidle0',
      })

      // Default options
      const pdfOptions = {
        format: options.format || 'A4',
        landscape: options.landscape || false,
        margin: options.margin || { top: '20mm', right: '15mm', bottom: '20mm', left: '15mm' },
        displayHeaderFooter: options.displayHeaderFooter || false,
        headerTemplate: options.headerTemplate || '',
        footerTemplate: options.footerTemplate || '',
        printBackground: true,
      }

      const pdfBuffer = await page.pdf(pdfOptions)

      return Buffer.from(pdfBuffer)
    } finally {
      await page.close()
    }
  }

  /**
   * Generate PDF from raw HTML string
   */
  async generateFromHtml(
    html: string,
    options: {
      format?: 'A4' | 'Letter'
      landscape?: boolean
      margin?: { top?: string; right?: string; bottom?: string; left?: string }
    } = {}
  ): Promise<Buffer> {
    const browser = await this.getBrowser()
    const page = await browser.newPage()

    try {
      await page.setContent(html, {
        waitUntil: 'networkidle0',
      })

      const pdfOptions = {
        format: options.format || 'A4',
        landscape: options.landscape || false,
        margin: options.margin || { top: '20mm', right: '15mm', bottom: '20mm', left: '15mm' },
        printBackground: true,
      }

      const pdfBuffer = await page.pdf(pdfOptions)

      return Buffer.from(pdfBuffer)
    } finally {
      await page.close()
    }
  }
}
