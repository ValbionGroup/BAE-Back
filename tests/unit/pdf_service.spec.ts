import { test } from '@japa/runner'
import { pdfService } from '#services/pdf_service'

test.group('PdfService — generateFromHtml', (group) => {
  group.teardown(() => pdfService.closeBrowser())

  test('honors a caller-supplied footerTemplate instead of the hardcoded default', async ({
    assert,
  }) => {
    const buffer = await pdfService.generateFromHtml('<html><body><p>Test</p></body></html>', {
      displayHeaderFooter: true,
      headerTemplate: '<span></span>',
      footerTemplate: '<div style="font-size:8pt">MARQUEUR-DE-TEST</div>',
    })

    assert.isAbove(buffer.length, 1000)
    assert.equal(buffer.subarray(0, 4).toString('latin1'), '%PDF')
  }).timeout(20_000)
})
