const formatToUsd = (number) => {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    currencyDisplay: "narrowSymbol",
    minimumFractionDigits: 0,
    maximumFractionDigits: 9,
  }).format(number);
};
const formatToUsPercent = (number) => {
  return new Intl.NumberFormat("en-US", {
    style: "percent",
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  }).format(number / 100);
};
const formatToUsNumber = (number, maximumFractionDigits = 9) => {
  return new Intl.NumberFormat("en-US", {
    minimumFractionDigits: 0,
    maximumFractionDigits,
  }).format(number);
};

function getPercentageChange(oldNumber, newNumber){
  if(oldNumber === 0) return '-';
  return ((oldNumber - newNumber) / oldNumber) * 100;
}