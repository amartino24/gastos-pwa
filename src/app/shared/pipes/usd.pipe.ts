import { Pipe, PipeTransform } from '@angular/core';
import { arsToUsd } from '../utils/currency';

/** `amountArs | usd: exchangeRate` → USD amount (or null without a valid rate). */
@Pipe({ name: 'usd' })
export class UsdPipe implements PipeTransform {
  transform(ars: number | null | undefined, rate: number | null | undefined): number | null {
    return arsToUsd(ars, rate);
  }
}
