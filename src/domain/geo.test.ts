import { describe, expect, it } from 'vitest';
import { formatLocationForClipboard, reportMapLocation } from './geo';

describe('formatLocationForClipboard', () => {
  it('shares the exact stored coordinates and a map link with place context', () => {
    expect(formatLocationForClipboard({
      labels: ['Market entrance', 'Djelfa', 'Algeria', 'Djelfa'],
      lat: 34.670412,
      lng: 3.250376,
    })).toBe([
      'Market entrance',
      'Djelfa',
      'Algeria',
      'Coordinates: 34.670412,3.250376',
      'Google Maps: https://www.google.com/maps/search/?api=1&query=34.670412%2C3.250376',
    ].join('\n'));
  });

  it('does not invent coordinates when a report only has a place label', () => {
    expect(formatLocationForClipboard({ labels: ['Market entrance', null] })).toBe('Market entrance');
  });
});

describe('reportMapLocation', () => {
  const wilayas = [{ code: 17, center_lat: 34.67, center_lng: 3.25 }];

  it('uses exact report coordinates when present', () => {
    expect(reportMapLocation({ lat: 35, lng: 4, wilayaCode: 17 }, wilayas)).toEqual({
      position: { lat: 35, lng: 4 },
      approximate: false,
    });
  });

  it('falls back to the selected wilaya center when a report has no GPS coordinates', () => {
    expect(reportMapLocation({ wilayaCode: 17 }, wilayas)).toEqual({
      position: { lat: 34.67, lng: 3.25 },
      approximate: true,
    });
  });

  it('does not invent a position without valid report or wilaya coordinates', () => {
    expect(reportMapLocation({ lat: 91, lng: 4, wilayaCode: 99 }, wilayas)).toBeNull();
  });
});