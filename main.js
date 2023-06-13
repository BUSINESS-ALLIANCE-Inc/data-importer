const fs = require('fs')
const path = require('path')
const {parse} = require('csv-parse/sync')

if (require.main === module) {
  main()
}

function main () {
  const source = path.join(__dirname, 'data', 'business_alliance.csv')
  const buffer = fs.readFileSync(source)
  const options = {escape: '\\'} // <1>
  const {ok, err} = canParse(buffer, options) // <2>

  if (ok) {
    const rows = parse(buffer, options) // <3>
    console.info(rows)
  } else {
    console.error(err)
  }
}

function canParse (data, options) {
  let ok, message

  try {
    parse(data, options)
    return {ok: true, err: null}
  } catch (err) {
    return {ok: false, err}
  }
}