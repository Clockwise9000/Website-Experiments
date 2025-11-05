/**
 * Real-Time Player Synchronization Backend using Google Sheets.
 *
 * This script serves as the API endpoint for clients (the HTML game)
 * to read and update player positions, online status, and notifications
 * stored in a Google Sheet.
 *
 * NOTE: Google Apps Script is not a true real-time server. Clients must
 * poll this script frequently to achieve a real-time effect.
 */

// --- CONFIGURATION VARIABLES (User requested all variables at the top) ---

// The ID of the Google Spreadsheet containing player data.
const SPREADSHEET_ID = '1JzTpRiR8LSCTxTTihyybqRkcqgGLkbGtH2N-c57Kd6s';

// The name of the sheet where player data is stored (Sheet1 based on input).
const DATA_SHEET_NAME = 'Sheet1';

// Headers defined in the user's data structure (used for indexing).
const HEADERS = {
  USER_ID: 0,
  X: 1,
  Y: 2,
  USER_ONLINE: 3,
  NOTIFICATION: 4,
  COLOR: 5
};

// Column letters for quick range access (A=1, B=2, etc.)
const MIN_COL_INDEX = 1; // Column A
const MAX_COL_INDEX = 6; // Column F (for 6 columns)

// --- CORE APPS SCRIPT FUNCTIONS ---

/**
 * Serves the HTML file for the web application.
 * @param {GoogleAppsScript.Events.DoGet} e The event object.
 * @returns {GoogleAppsScript.HTML.HtmlOutput} The HTML output.
 */
function doGet(e) {
  // Use HtmlService to serve the content of index.html
  return HtmlService.createTemplateFromFile('index')
      .evaluate()
      .setTitle('Realtime Game Client');
}


// --- DATA READ/WRITE FUNCTIONS ---

/**
 * Connects to the Spreadsheet and returns the specified sheet.
 * @returns {GoogleAppsScript.Spreadsheet.Sheet} The data sheet.
 */
function getSheet() {
  try {
    const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
    const sheet = ss.getSheetByName(DATA_SHEET_NAME);
    if (!sheet) {
      Logger.log(`Error: Sheet named '${DATA_SHEET_NAME}' not found.`);
      return null;
    }
    return sheet;
  } catch (e) {
    Logger.log(`Error accessing spreadsheet or sheet: ${e.toString()}`);
    return null;
  }
}

/**
 * Reads all player data from the sheet and returns it as an array of objects.
 * This function is called by the client to get the state of all players.
 * @returns {Object[]} Array of player objects.
 */
function readAllPlayers() {
  const sheet = getSheet();
  if (!sheet) return [];

  try {
    // Get all values, starting from the second row (skipping headers).
    const range = sheet.getRange(2, MIN_COL_INDEX, sheet.getLastRow() - 1, MAX_COL_INDEX);
    const values = range.getValues();

    // Map the raw array data into a structured array of objects.
    const players = values.map(row => {
      // Convert boolean-like number (0/1) to actual boolean/number types as needed
      const userId = parseInt(row[HEADERS.USER_ID]);
      const x = parseInt(row[HEADERS.X]);
      const y = parseInt(row[HEADERS.Y]);
      const userOnline = row[HEADERS.USER_ONLINE] == 1; // Treat 1 as true, 0 as false
      const notification = parseInt(row[HEADERS.NOTIFICATION]);
      const color = row[HEADERS.COLOR];

      return { userId, x, y, userOnline, notification, color };
    });

    // Log for debugging purposes
    Logger.log(`Successfully read ${players.length} players.`);
    return players;

  } catch (e) {
    Logger.log(`Error in readAllPlayers: ${e.toString()}`);
    return [];
  }
}

/**
 * Updates a specific player's data in the sheet.
 * This function is called by a single client to update its own state.
 * @param {Object} data - Contains {userId, x, y, userOnline, notification}.
 * @returns {boolean} True if update was successful, false otherwise.
 */
function updatePlayer(data) {
  const sheet = getSheet();
  if (!sheet) return false;

  const { userId, x, y, userOnline, notification } = data;

  try {
    // Get all User IDs to find the correct row number (starting from row 2)
    const idColumn = sheet.getRange(2, HEADERS.USER_ID + 1, sheet.getLastRow() - 1, 1).getValues();
    
    // Find the row index where the userId matches (array index + 2 for sheet row number)
    let rowIndex = -1;
    for (let i = 0; i < idColumn.length; i++) {
      if (idColumn[i][0] == userId) {
        rowIndex = i + 2; // +1 for 0-indexing to 1-indexing, +1 to skip header row
        break;
      }
    }

    if (rowIndex === -1) {
      Logger.log(`Error: User ID ${userId} not found for update.`);
      return false;
    }

    // Prepare the new row data array: [userId, x, y, userOnline, notification, color]
    // Get the existing color to prevent overwriting it (it's in column F)
    const existingColor = sheet.getRange(rowIndex, HEADERS.COLOR + 1).getValue();
    
    // Determine the values to write back to the sheet
    const valuesToUpdate = [
      userId,
      Math.round(x), // Use Math.round since X/Y are int16 in spec
      Math.round(y),
      userOnline ? 1 : 0, // Convert boolean back to 0 or 1 for Google Sheet
      notification,
      existingColor
    ];

    // Update the entire row range
    sheet.getRange(rowIndex, MIN_COL_INDEX, 1, MAX_COL_INDEX).setValues([valuesToUpdate]);

    Logger.log(`Successfully updated User ID ${userId}.`);
    return true;

  } catch (e) {
    Logger.log(`Error in updatePlayer for User ID ${userId}: ${e.toString()}`);
    return false;
  }
}
