import { ImageResponse } from 'next/og';

/**
 * The card WhatsApp and friends show when a link is shared -- and a shared
 * receipt link is how most people will first see this app. Drawn with the same
 * mark and colours as the icons; rendered at build time, so it costs the phone
 * nothing.
 */
export const alt = 'Kitabu — biashara yako, mkononi';
export const size = { width: 1200, height: 630 };
export const contentType = 'image/png';
export const dynamic = 'force-static';

const BRAND = '#0f6b3f';
const PAPER = '#faf8f4';
const EDGES = '#c9c2b4';

export default function OpengraphImage() {
  const rule = (width: number) => ({
    width,
    height: 22,
    borderRadius: 11,
    background: BRAND,
    marginBottom: 30,
  });

  return new ImageResponse(
    (
      <div
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          gap: 64,
          padding: '0 96px',
          background: BRAND,
          fontFamily: 'sans-serif',
        }}
      >
        {/* the mark: page edges behind a ruled cover */}
        <div style={{ display: 'flex', alignItems: 'stretch' }}>
          <div style={{ width: 54, height: 280, borderRadius: 30, background: EDGES, marginRight: -30 }} />
          <div
            style={{
              width: 200,
              height: 280,
              borderRadius: 30,
              background: PAPER,
              display: 'flex',
              flexDirection: 'column',
              justifyContent: 'center',
              paddingLeft: 44,
            }}
          >
            <div style={rule(110)} />
            <div style={rule(110)} />
            <div style={{ ...rule(66), marginBottom: 0 }} />
          </div>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', color: PAPER }}>
          <div style={{ fontSize: 108, fontWeight: 700, letterSpacing: -2 }}>Kitabu</div>
          <div style={{ fontSize: 44, opacity: 0.85, marginTop: 8 }}>Biashara yako, mkononi</div>
        </div>
      </div>
    ),
    size
  );
}
