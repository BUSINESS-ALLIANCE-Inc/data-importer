const fs = require('fs');
const path = require('path');
const { parse } = require('csv-parse/sync');
const axios = require('axios');

// このスクリプトが直接実行された場合のみ main 関数を呼び出す。
if (require.main === module) {
  main();
}

async function main() {
  const source1 = path.join(__dirname, 'data', 'business_alliance_test.csv');
  const source2 = path.join(__dirname, 'data', 'tickers_test.csv');

  // source1 の処理
  const buffer1 = fs.readFileSync(source1);
  const options1 = { escape: '\\' };
  const { ok: ok1, err: err1 } = canParse(buffer1, options1);

  if (ok1) {
    const rows1 = parse(buffer1, options1);
    const keys = ['ticker', 'fiscal_year', 'fiscal_quarter', 'end_date', 'market_capital', 'net_sales', 'operating_income', 'pbr', 'roe', 'employee_num'];

    const data = rows1.map(arr => {
      const obj = {};
      keys.forEach((key, index) => {
        obj[key] = arr[index];
      });
      return obj;
    });

    const result = {};

    for (const item of data) {
      const { ticker, fiscal_year, fiscal_quarter, end_date, market_capital, net_sales, operating_income, pbr, roe, employee_num } = item;

      if (!result[ticker]) {
        result[ticker] = {};
      }

      result[ticker][fiscal_year] = {
        fiscal_year,
        fiscal_quarter,
        end_date,
        market_capital,
        net_sales,
        operating_income,
        pbr,
        roe,
        employee_num
      };
    }

    const keyPairs = [];

    for (const parentKey in result) {
      if (result.hasOwnProperty(parentKey)) {
        const specificObject = result[parentKey];
        const lastKey = Object.keys(specificObject).pop();
        keyPairs.push({ parentKey, lastKey });
      }
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
        const parentKey = ticker;

        // keyPairsから該当のparentKeyの最後のkeyを取得
        const lastKey = keyPairs.find(pair => pair.parentKey === parentKey)?.lastKey;

        if (lastKey) {
          let fy = parseInt(lastKey) + 1;

          if (fy <= 2023) {
            for (; fy <= 2023; fy++) {
              // API呼び出しの処理
              const apiData = await callApi(parentKey, fy);
              // console.log(apiData);

              // apiDataが存在する場合のみマージする
              if (apiData && apiData.ticker) {

                // apiDataの変換とマージ
                const transformedData = {
                  [ticker]: {
                    [apiData.fiscal_year]: {
                      fiscal_year: apiData.fiscal_year,
                      fiscal_quarter: apiData.fiscal_quarter,
                      end_date: apiData.end_date,
                      market_capital: apiData.market_capital,
                      net_sales: apiData.net_sales,
                      operating_income: apiData.operating_income,
                      pbr: apiData.pbr,
                      roe: apiData.roe,
                      employee_num: apiData.employee_num
                    }
                  }
                };

                // resultにマージする
                if (!result[ticker]) {
                  result[ticker] = {};
                }
                result[ticker] = {
                  ...result[ticker],
                  ...transformedData[ticker]
                };
              }
            }
          }
        }
      }
      console.log(result);
    } else {
      // console.error('Error parsing source2:', err2);
    }
  } else {
    // console.error('Error parsing source1:', err1);
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

async function callApi(parentKey, fy) {
  try {
    const apiKey = 'WIWE5xnbk66CcBPOM5xk919vGq2lhp724AEMO2hR';
    const headers = {
      'x-api-key': apiKey
    };

    const quarterResponse = await callQuarterApi(headers, parentKey, fy);
    const dailyResponse = await callDailyApi(headers, parentKey, quarterResponse);

    // quarterResponseとdailyResponseのデータを合体させる
    const mergedData = {
      ...quarterResponse,
      ...dailyResponse
    };
    return mergedData;

  } catch (error) {
    // console.error(error);
  }
}

async function callQuarterApi(headers, parentKey, fy) {
  try {
    const params = {
      ticker: parentKey,
      fy,
      fq: 4,
      subjects: 'ticker,fiscal_year,fiscal_quarter,end_date,net_sales,operating_income,roe,employee_num'
    };

    const quarter = await axios.get('https://api.buffett-code.com/api/v3/quarter', { headers, params });
    const quarterResult = {
      ticker: quarter.data.data.ticker,
      fiscal_year: quarter.data.data.fiscal_year,
      fiscal_quarter: quarter.data.data.fiscal_quarter,
      end_date: quarter.data.data.end_date,
      net_sales: quarter.data.data.net_sales,
      operating_income: quarter.data.data.operating_income,
      roe: quarter.data.data.roe,
      employee_num: quarter.data.data.employee_num
    };
    return quarterResult;
  } catch (error) {
    // console.error(error);
  }
}

async function callDailyApi(headers, parentKey, quarterResponse) {
  try {
    const params = {
      ticker: parentKey,
      date: quarterResponse.end_date
    };

    const daily = await axios.get('https://api.buffett-code.com/api/v3/daily', { headers, params });
    const dailyResult = {
      ticker: daily.data.data.ticker,
      market_capital: daily.data.data.market_capital,
      pbr: daily.data.data.pbr,
      end_date: daily.data.data.day
    };
    return dailyResult;
  } catch (error) {
    // console.error(error);
  }
}