import puppeteer, { type Browser } from 'puppeteer'
import { readFile } from 'node:fs/promises'

import app from '@adonisjs/core/services/app'

export default class PdfService {
  private browser: Browser | null = null

  private readonly footerTemplate = `
    <div style="width:100%; font-size:8pt; color:#6b7280; font-family:-apple-system,'Segoe UI','Helvetica Neue',Arial,sans-serif; border-top:1px solid #14283f; padding: 4px 20mm 0;display:flex; justify-content:space-between;">
      <span>BAE - ENSEIRB MATMECA</span>
      <span>Page <span class="pageNumber"></span> / <span class="totalPages"></span></span>
    </div>`

  private async getBrowser(): Promise<Browser> {
    if (!this.browser) {
      this.browser = await puppeteer.launch({
        headless: true,
        args: ['--no-sandbox', '--disable-setuid-sandbox'],
      })
    }
    return this.browser
  }

  async closeBrowser(): Promise<void> {
    if (this.browser) {
      await this.browser.close()
      this.browser = null
    }
  }

  private compileTemplate(template: string, data: Record<string, any>): string {
    return template.replace(/\{\{([^}]+)\}\}/g, (_, key) => {
      const trimmedKey = key.trim()
      return data[trimmedKey] !== undefined ? String(data[trimmedKey]) : ''
    })
  }

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
      const templateContent = await readFile(
        app.makePath('resources/views/pdfs', templatePath),
        'utf-8'
      )

      const compiledHtml = this.compileTemplate(templateContent, data)

      await page.setContent(compiledHtml, {
        waitUntil: 'load',
      })

      const pdfOptions = {
        format: options.format || 'A4',
        landscape: options.landscape || false,
        margin: options.margin || { top: '0', right: '0', bottom: '16mm', left: '0' },
        displayHeaderFooter: options.displayHeaderFooter ?? true,
        headerTemplate: options.headerTemplate || '<span></span>',
        footerTemplate: options.footerTemplate || this.footerTemplate,
        printBackground: true,
      }

      const pdfBuffer = await page.pdf(pdfOptions)

      return Buffer.from(pdfBuffer)
    } finally {
      await page.close()
    }
  }

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
        waitUntil: 'load',
      })

      const pdfOptions = {
        format: options.format || 'A4',
        landscape: options.landscape || false,
        margin: options.margin || { top: '0', right: '0', bottom: '16mm', left: '0' },
        displayHeaderFooter: true,
        headerTemplate: '<span></span>',
        footerTemplate: this.footerTemplate,
        printBackground: true,
      }

      const pdfBuffer = await page.pdf(pdfOptions)

      return Buffer.from(pdfBuffer)
    } finally {
      await page.close()
    }
  }
}
