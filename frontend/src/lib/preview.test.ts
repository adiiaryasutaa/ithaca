import { describe, it, expect } from 'vitest';
import { getPreviewKind, officeViewerUrl, isSpreadsheetMimeType } from './preview';

describe('getPreviewKind', () => {
  it('returns null for missing mime type', () => {
    expect(getPreviewKind(undefined)).toBeNull();
    expect(getPreviewKind('')).toBeNull();
  });

  it('classifies images (incl. google drawing)', () => {
    expect(getPreviewKind('image/png')).toBe('image');
    expect(getPreviewKind('application/vnd.google-apps.drawing')).toBe('image');
  });

  it('classifies video', () => {
    expect(getPreviewKind('video/mp4')).toBe('video');
  });

  it('classifies pdf and google docs as document', () => {
    expect(getPreviewKind('application/pdf')).toBe('document');
    expect(getPreviewKind('application/vnd.google-apps.document')).toBe('document');
    expect(getPreviewKind('application/vnd.google-apps.spreadsheet')).toBe('document');
  });

  it('classifies office files as office', () => {
    expect(getPreviewKind('application/msword')).toBe('office');
    expect(
      getPreviewKind('application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'),
    ).toBe('office');
  });

  it('returns null for unknown types', () => {
    expect(getPreviewKind('application/zip')).toBeNull();
  });
});

describe('officeViewerUrl', () => {
  it('wraps and url-encodes the source', () => {
    expect(officeViewerUrl('https://x.com/a b.docx')).toBe(
      'https://view.officeapps.live.com/op/embed.aspx?src=https%3A%2F%2Fx.com%2Fa%20b.docx',
    );
  });
});

describe('isSpreadsheetMimeType', () => {
  it('is true for spreadsheet mimetypes', () => {
    expect(isSpreadsheetMimeType('application/vnd.google-apps.spreadsheet')).toBe(true);
    expect(isSpreadsheetMimeType('application/vnd.ms-excel')).toBe(true);
    expect(
      isSpreadsheetMimeType('application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'),
    ).toBe(true);
  });

  it('is false otherwise', () => {
    expect(isSpreadsheetMimeType('application/pdf')).toBe(false);
    expect(isSpreadsheetMimeType(undefined)).toBe(false);
  });
});
