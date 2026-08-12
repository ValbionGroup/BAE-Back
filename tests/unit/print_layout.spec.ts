import { test } from '@japa/runner'
import { escapeHtml, printHead, printPage, printFooterTemplate } from '#services/print/print_layout'

test.group('print_layout', () => {
  test('escapeHtml neutralizes angle brackets and ampersands', ({ assert }) => {
    assert.equal(escapeHtml('Soirée <BBQ> & Cie'), 'Soirée &lt;BBQ&gt; &amp; Cie')
  })

  test('printHead embeds the document title and the event name', ({ assert }) => {
    const html = printHead('Fiche logistique — liste de courses', 'Soirée Hivernale')
    assert.include(html, 'Fiche logistique — liste de courses')
    assert.include(html, 'Soirée Hivernale')
  })

  test('printHead omits the event block when no event is given', ({ assert }) => {
    const html = printHead('Fiche recette — assemblage')
    assert.notInclude(html, 'font-weight:600;font-size:13.5px')
  })

  test('printPage wraps the head and body in one standalone HTML document', ({ assert }) => {
    const html = printPage('Titre', 'Événement', '<p>corps</p>')
    assert.include(html, '<!doctype html>')
    assert.include(html, 'Titre')
    assert.include(html, 'Événement')
    assert.include(html, '<p>corps</p>')
  })

  test('printFooterTemplate carries the note and Puppeteer page counters', ({ assert }) => {
    const html = printFooterTemplate('Note de test')
    assert.include(html, 'Note de test')
    assert.include(html, 'class="pageNumber"')
    assert.include(html, 'class="totalPages"')
  })
})
