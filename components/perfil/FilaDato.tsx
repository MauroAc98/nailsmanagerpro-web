'use client';

interface Props {
  label: string;
  valor: string | null | undefined;
}

export function FilaDato({ label, valor }: Props) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
      <span style={{ fontSize: 13, color: '#888' }}>{label}</span>
      {valor ? (
        <span style={{
          fontSize: 13, fontWeight: 600, color: '#333', textAlign: 'right',
          maxWidth: '60%', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
        }}>
          {valor}
        </span>
      ) : (
        <span style={{ fontSize: 13, fontStyle: 'italic', color: '#CCC', textAlign: 'right', maxWidth: '60%' }}>
          Sin completar
        </span>
      )}
    </div>
  );
}
