const fs = require('fs');
const path = require('path');
const { parse } = require('csv-parse/sync');
const axios = require('axios');
const csvWriter = require('csv-write-stream');

const START_YEAR = 2005;
const END_YEAR = 2022;

// このスクリプトが直接実行された場合のみ main 関数を呼び出す。
if (require.main === module) {
  main();
}

async function main() {
  const source = path.join(__dirname, 'data', 'tickers_test.csv');

  const buffer = fs.readFileSync(source);
  const options = { escape: '\\' };
  const { ok, err } = canParse(buffer, options);

  if (ok) {
    const rows = parse(buffer, options);
    for (const item of rows) {
      const ticker = item[0];
      for (let fy = START_YEAR; fy <= END_YEAR; fy++) {
        for (let fq = 1; fq <= 4; fq++) {
          const apiData = await callApi(ticker, fy, fq);
          const stockPriceData = {
            ticker: apiData.ticker,
            fiscal_year: apiData.fiscal_year,
            fiscal_quarter: apiData.fiscal_quarter,
            end_date: apiData.end_date,
            stock_price: apiData.market_capital / apiData.issued_share_num,
          }
          console.log(stockPriceData);
          // if (apiData) {
          //   writer.write(apiData);
          // }
        }
      }
    }
  } else {
    // console.error(11, err);
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

async function callApi(ticker, fy, fq) {
  try {
    const apiKey = 'WIWE5xnbk66CcBPOM5xk919vGq2lhp724AEMO2hR';
    const headers = {
      'x-api-key': apiKey
    };

    const quarterResponse = await callQuarterApi(headers, ticker, fy, fq);
    const dailyResponse = await callDailyApi(headers, ticker, quarterResponse);

    // quarterResponseとdailyResponseのデータを合体させる
    const mergedData = {
      ...quarterResponse,
      ...dailyResponse
    };
    return mergedData;
  } catch (error) {
    return null;
  }
}

async function callQuarterApi(headers, ticker, fy, fq) {
  try {
    const params = {
      ticker: ticker,
      fy: fy,
      fq: fq,
      subjects: 'ticker,fiscal_year,fiscal_quarter,end_date,issued_share_num'
    };

    const quarter = await axios.get('https://api.buffett-code.com/api/v3/ondemand/quarter', { headers, params });
    const quarterResult = {
      ticker: quarter.data.data.ticker,
      fiscal_year: quarter.data.data.fiscal_year,
      fiscal_quarter: quarter.data.data.fiscal_quarter,
      end_date: quarter.data.data.end_date,
      issued_share_num: quarter.data.data.issued_share_num,
    };

    return quarterResult;
  } catch (error) {
    return null;
  }
}

async function callDailyApi(headers, ticker, quarterResponse, formattedEndDate = null) {
  const endDate = formattedEndDate ? new Date(formattedEndDate) : new Date(quarterResponse.end_date);
  const date = endDate.toISOString().split('T')[0]
  try {
    const params = {
      ticker: ticker,
      date: date,
    };

    const daily = await axios.get('https://api.buffett-code.com/api/v3/ondemand/daily', { headers, params });
    const dailyResult = {
      ticker: daily.data.data.ticker,
      market_capital: daily.data.data.market_capital,
      end_date: daily.data.data.day
    };
    return dailyResult;
  } catch (error) {
    if (error.response && error.response.status === 404) {
      const endDate = new Date(date);
      endDate.setDate(endDate.getDate() - 1);

      // 遡るMAX日を取得するためにendDateから7日前の日付を求める
      const sevenDaysAgo = new Date(quarterResponse.end_date);
      sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

      if (endDate.getTime() === sevenDaysAgo.getTime()) {
        return null;
      }
      const formattedEndDate = endDate.toISOString().split('T')[0];
      return await callDailyApi(headers, ticker, quarterResponse, formattedEndDate);
    } else {
      // throw error; // その他のエラーは再スロー
    }
  }
}
