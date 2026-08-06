import { useMemo } from 'react';
import { useDashboardScope } from './DashboardScope.jsx';
import {
  currencyFor, formatMoney, formatMoneyCompact, formatMoneyWithCode,
} from '../utils/formatters.js';

/**
 * The currency of the reporting entity in scope — NZD for a New Zealand firm, AUD for an
 * Australian one. Every amount input and display goes through this so a firm never sees a
 * jurisdiction that isn't its own.
 *
 * With no entity selected (ROOT viewing "All entities") there is no single currency, so this
 * falls back to NZD. Amounts shown there can span firms and should be read as indicative.
 *
 *   const money = useCurrency();
 *   money.format(1250000)        // "$1,250,000"  — beside a header that says NZD
 *   money.formatWithCode(1250000)// "NZD $1,250,000" — standalone chip or tile
 *   money.label                  // "NZD $" — for input labels and column headers
 */
export function useCurrency() {
  const { firm } = useDashboardScope();
  const country = firm?.country ?? null;

  return useMemo(() => {
    const { code, locale } = currencyFor(country);
    return {
      country,
      code,
      locale,
      label: `${code} $`,
      format: (value) => formatMoney(value, country),
      formatWithCode: (value) => formatMoneyWithCode(value, country),
      formatCompact: (value) => formatMoneyCompact(value, country),
    };
  }, [country]);
}
