const fs = require('fs');
const path = require('path');
const { parse } = require('csv-parse/sync');
const axios = require('axios');
const csvWriter = require('csv-write-stream');

// このスクリプトが直接実行された場合のみ main 関数を呼び出す。
if (require.main === module) {
  main();
}

async function main() {
  // 初期データのtickerをまとめたcsvファイルの読み込み
  const source = path.join(__dirname, 'data', 'tickers.csv');

  const writer = csvWriter();
  const output = fs.createWriteStream(path.join(__dirname, 'data', 'listing_date.csv'));

  writer.pipe(output);

  // sourceの処理
  const buffer = fs.readFileSync(source);
  const options = { escape: '\\' };
  const { ok, err } = canParse(buffer, options);

  if (ok) {
    const rows = parse(buffer, options);
    for (const item of rows) {
      const ticker = item[0];

        // API呼び出しの処理
        const apiData = await callApi(ticker);
        console.log(apiData);
        if (apiData) {
          writer.write(apiData);

      }
    }
  } else {
    console.error(11, err);
  }

  writer.end();
}

function canParse(data, options) {
  let ok, message;

  try {
    parse(data, options);
    return { ok: true, err: null };
  } catch (err) {
    return { ok: false, err };
  }
}

async function callApi(ticker, fy) {
  try {
    const apiKey = 'XAO33p1bVm2jgB3lbSmP17CcViBrlltO5mhg0UYq';
    const headers = {
      'x-api-key': apiKey
    };

    // 1. quarter APIを呼び出す
    const quarterResponse = await callQuarterApi(headers, ticker, fy);
    return quarterResponse;

  } catch (error) {
    return null;
  }
}

async function callQuarterApi(headers, ticker, fy) {
  try {
    const params = {
      ticker: ticker,
    };

    const quarter = await axios.get('https://api.buffett-code.com/api/v3/company', { headers, params });
    const quarterResult = {
      ticker: quarter.data.data.ticker,
      listing_date: quarter.data.data.listing_date,
    };
    return quarterResult;
  } catch (error) {
    return null;
  }
}
