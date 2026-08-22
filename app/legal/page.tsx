'use client';

import Link from 'next/link';
import { useTranslations } from 'next-intl';
import { colors } from '@/theme/colors';
import { agendaFontSerif } from '@/theme/agendaColors';

export default function LegalPage() {
  const t = useTranslations('legal.LegalPage');

  return (
    <div style={{ minHeight: '100vh', backgroundColor: colors.background, padding: '48px 24px' }}>
      <div style={{ maxWidth: 640, margin: '0 auto' }}>
        <Link
          href="/login"
          style={{ fontSize: 13, color: colors.primaryDeep, fontWeight: 600, textDecoration: 'none' }}
        >
          {t('back')}
        </Link>

        <h1 style={{ fontFamily: agendaFontSerif, fontSize: 28, fontWeight: 400, color: colors.text, marginTop: 24, marginBottom: 8 }}>
          {t('title')}
        </h1>
        <p style={{ fontSize: 13, color: colors.subtext, marginBottom: 32 }}>
          {t('lastUpdated')}
        </p>

        <section style={{ marginBottom: 28 }}>
          <h2 style={{ fontSize: 17, fontWeight: 700, color: colors.text, marginBottom: 8 }}>
            {t('ownershipTitle')}
          </h2>
          <p style={{ fontSize: 14, color: colors.subtext, lineHeight: 1.7 }}>
            {t('ownershipText')}
          </p>
        </section>

        <section style={{ marginBottom: 28 }}>
          <h2 style={{ fontSize: 17, fontWeight: 700, color: colors.text, marginBottom: 8 }}>
            {t('responsibleTitle')}
          </h2>
          <div style={{ fontSize: 14, color: colors.subtext, lineHeight: 1.9 }}>
            <p style={{ margin: 0 }}><strong style={{ color: colors.text }}>{t('legalNameLabel')}</strong> {t('legalNameValue')}</p>
            <p style={{ margin: 0 }}><strong style={{ color: colors.text }}>{t('brandLabel')}</strong> {t('brandValue')}</p>
            <p style={{ margin: 0 }}><strong style={{ color: colors.text }}>{t('taxStatusLabel')}</strong> {t('taxStatusValue')}</p>
          </div>
        </section>

        <section style={{ marginBottom: 28 }}>
          <h2 style={{ fontSize: 17, fontWeight: 700, color: colors.text, marginBottom: 8 }}>
            {t('usageTitle')}
          </h2>
          <p style={{ fontSize: 14, color: colors.subtext, lineHeight: 1.7 }}>
            {t('usageText')}
          </p>
        </section>

        <section style={{ marginBottom: 28 }}>
          <h2 style={{ fontSize: 17, fontWeight: 700, color: colors.text, marginBottom: 8 }}>
            {t('privacyTitle')}
          </h2>
          <p style={{ fontSize: 14, color: colors.subtext, lineHeight: 1.7, marginBottom: 12 }}>
            {t('privacyCollectedText')}
          </p>
          <p style={{ fontSize: 14, color: colors.subtext, lineHeight: 1.7, marginBottom: 12 }}>
            {t('privacyPurposeText')}
          </p>
          <p style={{ fontSize: 14, color: colors.subtext, lineHeight: 1.7, marginBottom: 12 }}>
            {t('privacyThirdPartiesText')}
          </p>
          <p style={{ fontSize: 14, color: colors.subtext, lineHeight: 1.7 }}>
            {t('privacyRetentionText')}
          </p>
        </section>

        <section>
          <h2 style={{ fontSize: 17, fontWeight: 700, color: colors.text, marginBottom: 8 }}>
            {t('contactTitle')}
          </h2>
          <p style={{ fontSize: 14, color: colors.subtext, lineHeight: 1.7 }}>
            {t.rich('contactText', {
              email: (chunks) => (
                <a key="email" href="mailto:nailsmanagerpro.app@gmail.com" style={{ color: colors.primaryDeep, fontWeight: 600 }}>
                  {chunks}
                </a>
              ),
            })}
          </p>
        </section>
      </div>
    </div>
  );
}
