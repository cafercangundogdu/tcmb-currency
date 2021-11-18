import axios from "axios";
import xml2js from "xml2js";
import moment, {Moment, MomentInput} from "moment";

const tcmbApiUrlToday = 'https://www.tcmb.gov.tr/kurlar/today.xml';
const tcmbApiUrlTimed = 'https://www.tcmb.gov.tr/kurlar/$year$month/$day$month$year.xml';
const validCurrencies = ['USD', 'GBP', 'EUR']

type Currency = {currency: string, buy: number, sell: number}
const replaceAll = (target: string, from: string, to: string): string => target.split(from).join(to)
const getPreviousWorkday = (workday: Moment): Moment =>
  workday.subtract(workday.day() === 6 ? 1 : (workday.day()  === 0 ? 2 : 0), 'days')

const fetchData = async (url: string): Promise<string> =>
  await axios.get(url)
    .then(res => res.data)
    .catch(() => "")

const generateTcmbUrl = (momentDate: Moment): string => {
  let url = tcmbApiUrlToday
  if(moment().diff(momentDate, 'days') > 0) {
    url = replaceAll(
      replaceAll(
        replaceAll(tcmbApiUrlTimed,
          '$year', momentDate.year().toString()),
        '$month', (momentDate.month() + 1).toString()),
      '$day', momentDate.date().toString()
    )
  }
  return url
}

const parseData = async (rawData: string, doFilter=true): Promise<Currency[]> =>
  await xml2js.parseStringPromise(rawData)
    .then(result => result.Tarih_Date.Currency)
    .then(currencies => doFilter ? currencies.filter(currency => validCurrencies.includes(currency.$.Kod.toUpperCase())) : currencies)
    .then(currencies => currencies.map(currency => ({currency: currency.$.Kod, buy: currency.ForexBuying[0], sell: currency.ForexSelling[0]})))
    .catch(() => []);

export const getCurrencies = async (date: MomentInput): Promise<Currency[]> => {
  const momentDate = moment(date)
  let subs = 0;
  let currencies = [];
  let previousWorkdayMoment;
  let url;
  do {
    previousWorkdayMoment = getPreviousWorkday(subs === 0 ? momentDate : momentDate.subtract(subs, 'days'));
    url = generateTcmbUrl(previousWorkdayMoment)
    currencies = await parseData(await fetchData(url))
    subs++;
  } while (currencies.length === 0)
  return currencies
}

export const getCurrency = async (date: MomentInput, currencyCode: string): Promise<Currency> =>
  await getCurrencies(date)
    .then(currencies => currencies.find(c => c.currency.toUpperCase() === currencyCode.toUpperCase()))
