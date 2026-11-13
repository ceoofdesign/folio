/**
 * Records board for the tower game on the portfolio.
 *
 * Setup (once, about five minutes):
 * 1. Create a Google Sheet, for example "Tower records".
 * 2. Extensions → Apps Script. Replace the code there with this file and save.
 * 3. Deploy → New deployment → type "Web app". Execute as: Me. Who has access: Anyone. Deploy and allow access.
 * 4. Copy the web app URL (it ends with /exec) into leaderboard_url in _config.yml.
 *
 * The sheet "Scores" is created on the first request. To hide a record from the site,
 * put anything in its "Hidden" cell, or delete the row.
 */
const SHEET_NAME = 'Scores';
const TOP = 50;
const MAX_SCORE = 300;
// For a standalone script (made at script.new rather than from the sheet), put the sheet's ID here:
// the part of its address between /d/ and /edit
const SPREADSHEET_ID = '';

function sheet_() {
  const book = SPREADSHEET_ID ? SpreadsheetApp.openById(SPREADSHEET_ID) : SpreadsheetApp.getActiveSpreadsheet();
  let sheet = book.getSheetByName(SHEET_NAME);
  if (!sheet) {
    sheet = book.insertSheet(SHEET_NAME);
    sheet.appendRow(['Date', 'Name', 'Company', 'Score', 'Lang', 'Seconds', 'Hidden']);
    sheet.setFrozenRows(1);
  }
  return sheet;
}

// Plain text only, and never something the sheet would read as a formula
function clean_(value, max) {
  const text = String(value || '').replace(/[\u0000-\u001f\u007f]/g, '').replace(/\s+/g, ' ').trim().slice(0, max);
  return /^[=+\-@]/.test(text) ? "'" + text : text;
}

function same_(a, b) {
  return String(a).replace(/^'/, '').toLowerCase() === String(b).replace(/^'/, '').toLowerCase();
}

function rows_() {
  const sheet = sheet_();
  const count = sheet.getLastRow() - 1;
  if (count < 1) return [];
  return sheet.getRange(2, 1, count, 7).getValues()
    .map((r, i) => ({ row: i + 2, date: r[0], name: String(r[1]), company: String(r[2] || ''), score: Number(r[3]) || 0, hidden: r[6] }))
    .filter((r) => r.name && !r.hidden)
    .sort((a, b) => b.score - a.score || new Date(a.date) - new Date(b.date));
}

function public_(list) {
  return list.slice(0, TOP).map((r) => ({
    name: r.name.replace(/^'/, ''),
    company: r.company.replace(/^'/, ''),
    score: r.score,
    date: r.date instanceof Date ? r.date.toISOString().slice(0, 10) : String(r.date).slice(0, 10),
  }));
}

function out_(data) {
  return ContentService.createTextOutput(JSON.stringify(data)).setMimeType(ContentService.MimeType.JSON);
}

function doGet() {
  const list = rows_();
  return out_({ ok: true, total: list.length, board: public_(list) });
}

function doPost(e) {
  const lock = LockService.getScriptLock();
  lock.waitLock(5000);
  try {
    const data = JSON.parse((e && e.postData && e.postData.contents) || '{}');
    const name = clean_(data.name, 40);
    const company = clean_(data.company, 60);
    const lang = clean_(data.lang, 5);
    const score = Math.floor(Number(data.score));
    const seconds = Math.floor(Number(data.seconds) || 0);
    // Each screen takes the crane close to a second, so a run can't be faster than that
    if (!name || !(score >= 1 && score <= MAX_SCORE) || seconds < score * 0.6) return out_({ ok: false, error: 'invalid' });

    const cache = CacheService.getScriptCache();
    const recent = Number(cache.get('posts') || 0);
    if (recent > 30) return out_({ ok: false, error: 'busy' });
    cache.put('posts', String(recent + 1), 60);

    // One line per person and company: a better run replaces the old one
    const sheet = sheet_();
    const existing = rows_().find((r) => same_(r.name, name) && same_(r.company, company));
    if (existing) {
      if (score > existing.score) sheet.getRange(existing.row, 1, 1, 6).setValues([[new Date(), name, company, score, lang, seconds]]);
    } else {
      sheet.appendRow([new Date(), name, company, score, lang, seconds, '']);
    }

    const list = rows_();
    const rank = list.findIndex((r) => same_(r.name, name) && same_(r.company, company)) + 1;
    return out_({ ok: true, rank, total: list.length, board: public_(list) });
  } catch (err) {
    return out_({ ok: false, error: 'server' });
  } finally {
    lock.releaseLock();
  }
}

// Run once from the editor to create the sheet and grant access
function setup() {
  sheet_();
}
