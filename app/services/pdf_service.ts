import puppeteer, { type Browser, type Page } from 'puppeteer'
import { readFile } from 'node:fs/promises'

import app from '@adonisjs/core/services/app'
import env from '#start/env'

export type PdfOptions = {
  format?: 'A4' | 'Letter'
  landscape?: boolean
  margin?: { top?: string; right?: string; bottom?: string; left?: string }
  displayHeaderFooter?: boolean
  headerTemplate?: string
  footerTemplate?: string
}

export default class PdfService {
  private browser: Browser | null = null

  /** Renders in progress. The browser may only be closed at zero. */
  private inFlight = 0
  private idleTimer: NodeJS.Timeout | null = null

  private readonly footerTemplate = `
    <div style="width:100%; font-size:8pt; color:#6b7280; font-family:-apple-system,'Segoe UI','Helvetica Neue',Arial,sans-serif; border-top:1px solid #14283f; padding: 4px 20mm 0;display:flex; justify-content:space-between;">
      <span>BAE - ENSEIRB MATMECA</span>
      <span>Page <span class="pageNumber"></span> / <span class="totalPages"></span></span>
    </div>`

  private async getBrowser(): Promise<Browser> {
    if (this.browser && !this.browser.connected) {
      this.browser = null
    }

    if (!this.browser) {
      this.browser = await puppeteer.launch({
        headless: true,
        args: ['--no-sandbox', '--disable-setuid-sandbox'],
        executablePath: process.env.PUPPETEER_EXECUTABLE_PATH || undefined,
      })
    }

    return this.browser
  }

  async closeBrowser(): Promise<void> {
    if (this.idleTimer) {
      clearTimeout(this.idleTimer)
      this.idleTimer = null
    }

    const browser = this.browser
    this.browser = null
    await browser?.close()
  }

  private armIdleClose(): void {
    const minutes = env.get('PDF_BROWSER_IDLE_MINUTES') ?? 10
    if (minutes <= 0 || !this.browser) {
      return
    }

    this.idleTimer = setTimeout(() => {
      this.idleTimer = null
      if (this.inFlight === 0) {
        void this.closeBrowser()
      }
    }, minutes * 60_000)

    this.idleTimer.unref()
  }

  private compileTemplate(template: string, data: Record<string, any>): string {
    return template.replace(/\{\{([^}]+)\}\}/g, (_, key) => {
      const trimmedKey = key.trim()
      return data[trimmedKey] !== undefined ? String(data[trimmedKey]) : ''
    })
  }

  private async render(
    setContent: (page: Page) => Promise<void>,
    options: PdfOptions
  ): Promise<Buffer> {
    this.inFlight += 1
    if (this.idleTimer) {
      clearTimeout(this.idleTimer)
      this.idleTimer = null
    }

    try {
      const browser = await this.getBrowser()
      const page = await browser.newPage()

      try {
        await setContent(page)

        const pdfBuffer = await page.pdf({
          format: options.format || 'A4',
          landscape: options.landscape || false,
          margin: options.margin || { top: '0', right: '0', bottom: '16mm', left: '0' },
          displayHeaderFooter: options.displayHeaderFooter ?? true,
          headerTemplate: options.headerTemplate || '<span></span>',
          footerTemplate: options.footerTemplate || this.footerTemplate,
          printBackground: true,
        })

        return Buffer.from(pdfBuffer)
      } finally {
        await page.close()
      }
    } finally {
      this.inFlight -= 1
      if (this.inFlight === 0) {
        this.armIdleClose()
      }
    }
  }

  async generateFromTemplate(
    templatePath: string,
    data: Record<string, any>,
    options: PdfOptions = {}
  ): Promise<Buffer> {
    return this.render(async (page) => {
      const templateContent = await readFile(
        app.makePath('resources/views/pdfs', templatePath),
        'utf-8'
      )

      await page.setContent(this.compileTemplate(templateContent, data), { waitUntil: 'load' })
    }, options)
  }

  async generateFromHtml(html: string, options: PdfOptions = {}): Promise<Buffer> {
    return this.render((page) => page.setContent(html, { waitUntil: 'load' }), options)
  }
}

export const pdfService = new PdfService()
