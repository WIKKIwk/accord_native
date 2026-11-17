export type QolipCatalogConfirmation = { title: string; message: string; confirm: string; cancel?: string; dismissible: boolean; vertical?: boolean; resolve(value: boolean): void };
