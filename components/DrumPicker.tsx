'use client';

import { Fragment, useCallback, useRef, useEffect } from 'react';

const ITEM_H  = 44;
const VISIBLE = 5;
const PAD     = ITEM_H * Math.floor(VISIBLE / 2); // 88px

export interface DrumColumn {
  name:  string;
  items: string[];
}

interface DrumPickerProps {
  columns:  DrumColumn[];
  value:    Record<string, string>;
  onChange: (v: Record<string, string>) => void;
}

function DrumColumnView({
  col,
  selected,
  onChange,
}: {
  col:      DrumColumn;
  selected: string;
  onChange: (v: string) => void;
}) {
  const ref      = useRef<HTMLDivElement>(null);
  const ignoring = useRef(false);

  // Sync scroll position when selected changes externally
  useEffect(() => {
    if (!ref.current) return;
    const idx = col.items.indexOf(selected);
    if (idx < 0) return;
    const target = idx * ITEM_H;
    if (Math.round(ref.current.scrollTop) === target) return;
    ignoring.current = true;
    ref.current.scrollTop = target;
    requestAnimationFrame(() => { ignoring.current = false; });
  }, [col.items, selected]);

  const handleScroll = useCallback(() => {
    if (ignoring.current || !ref.current) return;
    const idx     = Math.round(ref.current.scrollTop / ITEM_H);
    const clamped = Math.max(0, Math.min(idx, col.items.length - 1));
    onChange(col.items[clamped]);
  }, [col.items, onChange]);

  return (
    <div style={{ flex: 1, position: 'relative' }}>
      <div
        ref={ref}
        onScroll={handleScroll}
        data-drum=""
        style={{
          height:          ITEM_H * VISIBLE,
          overflowY:       'scroll',
          scrollSnapType:  'y mandatory',
          scrollbarWidth:  'none',
          paddingTop:      PAD,
          paddingBottom:   PAD,
          boxSizing:       'border-box',
        }}
      >
        {col.items.map(item => (
          <div
            key={item}
            style={{
              height:          ITEM_H,
              scrollSnapAlign: 'center',
              display:         'flex',
              alignItems:      'center',
              justifyContent:  'center',
              fontSize:        20,
              color:           item === selected ? '#222' : '#CCC',
              userSelect:      'none',
              transition:      'color 0.15s',
            }}
          >
            {item}
          </div>
        ))}
      </div>

      {/* Gradient fades — top */}
      <div style={{
        position:      'absolute',
        top: 0, left: 0, right: 0,
        height:        PAD,
        background:    'linear-gradient(to bottom, white, transparent)',
        pointerEvents: 'none',
      }} />
      {/* Gradient fades — bottom */}
      <div style={{
        position:      'absolute',
        bottom: 0, left: 0, right: 0,
        height:        PAD,
        background:    'linear-gradient(to top, white, transparent)',
        pointerEvents: 'none',
      }} />
    </div>
  );
}

export function DrumPicker({ columns, value, onChange }: DrumPickerProps) {
  return (
    <>
      <style>{`[data-drum]::-webkit-scrollbar { display: none; }`}</style>
      <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
        {/* Center selection band */}
        <div style={{
          position:        'absolute',
          top:             '50%',
          left: 0, right:  0,
          height:          ITEM_H,
          transform:       'translateY(-50%)',
          borderTop:       '1px solid rgba(215,158,164,0.35)',
          borderBottom:    '1px solid rgba(215,158,164,0.35)',
          backgroundColor: 'rgba(215,158,164,0.07)',
          borderRadius:    10,
          pointerEvents:   'none',
          zIndex:          1,
        }} />

        {columns.map((col, i) => (
          <Fragment key={col.name}>
            <DrumColumnView
              col={col}
              selected={value[col.name] ?? col.items[0]}
              onChange={v => onChange({ ...value, [col.name]: v })}
            />
            {i < columns.length - 1 && (
              <span style={{
                fontSize:   22,
                fontWeight: 700,
                color:      '#999',
                flexShrink: 0,
                zIndex:     2,
              }}>
                :
              </span>
            )}
          </Fragment>
        ))}
      </div>
    </>
  );
}
