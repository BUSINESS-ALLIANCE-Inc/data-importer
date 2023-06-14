const fs = require('fs');
const path = require('path');
const { parse } = require('csv-parse/sync');
const axios = require('axios');

// このスクリプトが直接実行された場合のみ main 関数を呼び出す。
if (require.main === module) {
  main();
}

async function main() {
  const source1 = path.join(__dirname, 'data', 'business_alliance.csv');
  const source2 = path.join(__dirname, 'data', 'tickers.csv');

  // source1 の処理
  const buffer1 = fs.readFileSync(source1);
  const options1 = { escape: '\\' };
  const { ok: ok1, err: err1 } = canParse(buffer1, options1);

  if (ok1) {
    const rows1 = parse(buffer1, options1);
    // console.info('Data from source1:', rows1);
  } else {
    console.error('Error parsing source1:', err1);
  }

  // source2 の処理
  const buffer2 = fs.readFileSync(source2);
  const options2 = { escape: '\\' };
  const { ok: ok2, err: err2 } = canParse(buffer2, options2);

  if (ok2) {
    const rows2 = parse(buffer2, options2);
    // console.info('Data from source2:', rows2);
    for (const item of rows2) {
      const ticker = item[0];
      // ここで各データの処理を行う
      await callApi(ticker);
    }
  } else {
    console.error('Error parsing source2:', err2);
  }
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

async function callApi(ticker) {
  try {
    const apiKey = 'WIWE5xnbk66CcBPOM5xk919vGq2lhp724AEMO2hR';
    const headers = {
      'x-api-key': apiKey
    };

    const params = {
      ticker,
      fy: 2018,
      fq: 3
    };

    const response = await axios.get('https://api.buffett-code.com/api/v3/quarter', { headers, params });
    console.log(response.data);
  } catch (error) {
    console.error(error);
  }
}
