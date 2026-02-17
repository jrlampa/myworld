import csvParser from 'csv-parser';
import { Readable } from 'stream';

type RawBatchRow = {
    name?: string;
    lat?: string;
    lon?: string;
    radius?: string;
    mode?: string;
};

type ParsedBatchRow = {
    line: number;
    row: RawBatchRow;
};

const normalizeRow = (row: Record<string, unknown>): RawBatchRow => {
    const normalized: RawBatchRow = {};
    Object.entries(row).forEach(([key, value]) => {
        const trimmedKey = key.trim();
        const trimmedValue = typeof value === 'string' ? value.trim() : value;
        normalized[trimmedKey as keyof RawBatchRow] = typeof trimmedValue === 'string'
            ? trimmedValue
            : trimmedValue ? String(trimmedValue) : undefined;
    });

    return normalized;
};

const parseBatchCsv = (buffer: Buffer): Promise<ParsedBatchRow[]> =>
    new Promise((resolve, reject) => {
        const rows: ParsedBatchRow[] = [];
        let currentLine = 1;

        const stream = Readable.from(buffer);
        stream
            .pipe(csvParser())
            .on('data', (data: Record<string, unknown>) => {
                currentLine += 1;
                const row = normalizeRow(data);
                const hasValues = Object.values(row).some((value) => value && value.length > 0);
                if (hasValues) {
                    rows.push({ line: currentLine, row });
                }
            })
            .on('error', (error) => reject(error))
            .on('end', () => resolve(rows));
    });

export type { RawBatchRow, ParsedBatchRow };
export { parseBatchCsv };
