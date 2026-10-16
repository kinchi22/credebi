const twoDigits = (value: number): string => String(value).padStart(2, '0');

export const localDayOf = (date: Date): string =>
  `${String(date.getFullYear()).padStart(4, '0')}-${twoDigits(date.getMonth() + 1)}-${twoDigits(date.getDate())}`;
