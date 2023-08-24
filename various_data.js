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
  // 初期データのtickerをまとめたcsvファイルの読み込み
  const source = path.join(__dirname, 'data', 'tickers.csv');

  const writer = csvWriter();
  const output = fs.createWriteStream(path.join(__dirname, 'data', 'various_data.csv'));

  writer.pipe(output);

  // sourceの処理
  const buffer = fs.readFileSync(source);
  const options = { escape: '\\' };
  const { ok, err } = canParse(buffer, options);

  if (ok) {
    const rows = parse(buffer, options);
    for (const item of rows) {
      const ticker = item[0];
      // 2005年から2022年までのデータを取得する
      for (let fy = START_YEAR; fy <= END_YEAR; fy++) {
          // API呼び出しの処理
          const apiData = await callApi(ticker, fy);
          if (!apiData) {
            continue;
          }
          console.log(apiData);
          writer.write(apiData);
      }
    }
  } else {
    // console.error(11, err);
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

    // 2. daily APIを呼び出す
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

async function callQuarterApi(headers, ticker, fy) {
  try {
    const params = {
      ticker: ticker,
      fy: fy,
      fq: 4,
      subjects: 'ticker,fiscal_year,fiscal_quarter,end_date,shareholders_equity,capital_stock,cost_of_sales,gross_profit,gross_margin,operating_margin,ex_net_sales,ex_operating_income,ex_ordinary_income,ex_net_income,real_roe,roa,roic,r_and_d_expenses,net_sales_per_employee,eps_actual'
    };

    const quarter = await axios.get('https://api.buffett-code.com/api/v3/ondemand/quarter', { headers, params });
    const quarterResult = {
      ticker: quarter.data.data.ticker,
      fiscal_year: quarter.data.data.fiscal_year,
      fiscal_quarter: quarter.data.data.fiscal_quarter,
      end_date: quarter.data.data.end_date,
      shareholders_equity: quarter.data.data.shareholders_equity,
      capital_stock: quarter.data.data.capital_stock,
      cost_of_sales: quarter.data.data.cost_of_sales,
      gross_profit: quarter.data.data.gross_profit,
      gross_margin: quarter.data.data.gross_margin,
      operating_margin: quarter.data.data.operating_margin,
      ex_net_sales: quarter.data.data.ex_net_sales,
      ex_operating_income: quarter.data.data.ex_operating_income,
      ex_ordinary_income: quarter.data.data.ex_ordinary_income,
      ex_net_income: quarter.data.data.ex_net_income,
      real_roe: quarter.data.data.real_roe,
      roa: quarter.data.data.roa,
      roic: quarter.data.data.roic,
      r_and_d_expenses: quarter.data.data.r_and_d_expenses,
      net_sales_per_employee: quarter.data.data.net_sales_per_employee,
      eps_actual: quarter.data.data.eps_actual
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
      per_pbr: daily.data.data.per_pbr,
    };
    return dailyResult;

  } catch (error) {
    // もしデータが取得できなければ、前日のデータを取得する
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
