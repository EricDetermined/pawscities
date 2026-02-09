'use client';

import Link from 'next/link';
import { useState } from 'react';

export default function PrivacyPage() {
  const [language, setLanguage] = useState<'en' | 'fr'>('en');

  const content = {
    en: {
      title: 'Privacy Policy',
      lastUpdated: 'Last updated: February 2026',
      introduction:
        'Paw Cities ("we," "our," or "the Company") is committed to protecting your privacy and ensuring you have a positive experience on our website and services. This Privacy Policy explains how we collect, use, disclose, and safeguard your information in accordance with the General Data Protection Regulation (GDPR) and other applicable privacy laws.',
      sections: [
        {
          title: '1. Information We Collect',
          subsections: [
            {
              subtitle: 'Account Information',
              content:
                'When you create an account, we collect your name, email address, password, and profile information. This information is necessary to create and maintain your account.',
            },
            {
              subtitle: 'Dog Profile Information',
              content:
                'If you choose to create dog profiles, we collect information about your dogs including their name, breed, age, size, personality traits, and photos. This information helps personalize your experience.',
            },
            {
              subtitle: 'Usage Data',
              content:
                'We automatically collect information about how you interact with our platform, including pages visited, establishments viewed, reviews written, check-ins recorded, and favorites saved. This helps us improve our services.',
            },
            {
              subtitle: 'Location Data',
              content:
                'If you enable location services, we may collect your approximate geographic location to show nearby dog-friendly establishments. Location data is only collected when explicitly authorized by you.',
            },
            {
              subtitle: 'Device Information',
              content:
                'We collect information about the devices you use to access our platform, including device type, operating system, browser type, and unique device identifiers.',
            },
            {
              subtitle: 'Cookies and Tracking',
              content:
                'We use cookies, web beacons, and similar tracking technologies to personalize your experience, remember your preferences, understand usage patterns, and prevent fraud. You can control cookie settings in your browser.',
            },
          ],
        },
        {
          title: '2. How We Use Your Information',
          content:
            'We use the information we collect for the following purposes:',
          list: [
            'Providing and improving our services',
            'Creating and managing your account',
            'Personalizing your experience and showing relevant dog-friendly establishments',
            'Processing and managing your reviews, check-ins, and favorites',
            'Communicating with you about your account, updates, and new features',
            'Responding to your inquiries and customer support requests',
            'Conducting research and analytics to improve our platform',
            'Detecting and preventing fraud, abuse, and security incidents',
            'Complying with legal obligations and enforcing our Terms of Service',
          ],
        },
        {
          title: '3. Legal Basis for Processing (GDPR)',
          content:
            'We process your personal data on the following legal bases:',
          list: [
            'Consent: When you have explicitly consented to the processing',
            'Contract Performance: To provide the services you have requested',
            'Legal Obligation: To comply with applicable laws and regulations',
            'Legitimate Interests: To improve our services, prevent fraud, and operate our business',
            'Vital Interests: To protect your health, safety, or vital interests',
          ],
        },
        {
          title: '4. Third-Party Service Providers',
          subsections: [
            {
              subtitle: 'Supabase',
              content:
                'We use Supabase for authentication and database services. Supabase is certified as a GDPR-compliant data processor and handles user credentials securely.',
            },
            {
              subtitle: 'Stripe',
              content:
                'If applicable, we use Stripe for payment processing. Stripe is PCI-DSS compliant and processes payment information securely without us accessing your full payment details.',
            },
            {
              subtitle: 'Cloudinary',
              content:
                'We use Cloudinary to store, optimize, and deliver images of establishments and user-uploaded photos. Cloudinary maintains GDPR compliance.',
            },
            {
              subtitle: 'Third-Party Analytics',
              content:
                'We may use analytics services to understand usage patterns and improve our platform. These providers are GDPR-compliant and process data only on our behalf.',
            },
          ],
        },
        {
          title: '5. Data Retention',
          content:
            'We retain your personal data for as long as necessary to provide our services and fulfill the purposes described in this policy. Specifically:',
          list: [
            'Account data is retained while your account is active',
            'Usage data and analytics are retained for up to 12 months',
            'Dog profile information is retained until you delete it or your account',
            'Reviews and check-ins are retained indefinitely to maintain the integrity of our platform, unless you request deletion',
            'Location data is not stored permanently; it is processed only to show nearby establishments',
            'When your account is deleted, we anonymize personal data within 30 days',
          ],
        },
        {
          title: '6. Your GDPR Rights',
          content:
            'Under GDPR, you have the following rights regarding your personal data:',
          subsections: [
            {
              subtitle: 'Right of Access',
              content:
                'You have the right to request a copy of all personal data we hold about you. You can request a data export through your account settings or by contacting us.',
            },
            {
              subtitle: 'Right of Correction',
              content:
                'You have the right to correct inaccurate or incomplete personal data. You can update most information directly in your account settings.',
            },
            {
              subtitle: 'Right of Erasure',
              content:
                'You have the right to request deletion of your personal data, subject to certain legal exceptions. We will delete your account and anonymize your data within 30 days of your request.',
            },
            {
              subtitle: 'Right to Data Portability',
              content:
                'You have the right to receive your personal data in a structured, commonly-used, machine-readable format and to transmit that data to another service. We provide a data export feature for this purpose.',
            },
            {
              subtitle: 'Right to Restrict Processing',
              content:
                'You have the right to restrict how we process your personal data in certain circumstances. You can control marketing communications and data usage through your account settings.',
            },
            {
              subtitle: 'Right to Object',
              content:
                'You have the right to object to processing for legitimate interests, marketing communications, and automated decision-making. You can manage these preferences in your account.',
            },
            {
              subtitle: 'Rights Related to Automated Decision-Making',
              content:
                'We do not use your data for automated decision-making that produces legal or similarly significant effects without your consent.',
            },
          ],
        },
        {
          title: '7. Data Security',
          content:
            'We implement comprehensive technical and organizational measures to protect your personal data against unauthorized access, alteration, disclosure, or destruction. These measures include:',
          list: [
            'Encryption of data in transit (HTTPS/TLS)',
            'Encryption of sensitive data at rest',
            'Secure authentication mechanisms',
            'Regular security audits and penetration testing',
            'Access controls limiting data access to authorized personnel',
            'Secure backup and recovery procedures',
            'Incident response plan for data breaches',
          ],
        },
        {
          title: '8. International Data Transfers',
          content:
            'If we transfer personal data outside the European Economic Area (EEA), we implement appropriate safeguards such as Standard Contractual Clauses to ensure an adequate level of protection in compliance with GDPR.',
        },
        {
          title: '9. Cookies and Tracking Technologies',
          subsections: [
            {
              subtitle: 'Essential Cookies',
              content:
                'These cookies are necessary for authentication and security. They cannot be disabled.',
            },
            {
              subtitle: 'Functional Cookies',
              content:
                'These cookies remember your preferences and personalization settings.',
            },
            {
              subtitle: 'Analytics Cookies',
              content:
                'These cookies help us understand how you use our platform to improve it. You can opt-out of analytics.',
            },
            {
              subtitle: 'Marketing Cookies',
              content:
                'We do not use marketing or advertising cookies at this time.',
            },
          ],
        },
        {
          title: '10. Children\'s Privacy',
          content:
            'Paw Cities is not intended for children under 13 years of age, and we do not knowingly collect personal data from children under 13. If we become aware that we have collected data from a child under 13, we will delete it immediately. Parents or guardians who believe we have collected information about their child may contact us at the email below.',
        },
        {
          title: '11. Changes to This Privacy Policy',
          content:
            'We may update this Privacy Policy periodically to reflect changes in our practices, technology, regulations, or other factors. We will notify you of material changes by updating the "Last Updated" date and prominently displaying changes on our website. Your continued use of Paw Cities after changes constitutes your acceptance of the updated Privacy Policy.',
        },
        {
          title: '12. Contact Information & Data Protection Officer',
          content:
            'If you have questions about this Privacy Policy, wish to exercise your GDPR rights, or believe we have mishandled your personal data, please contact us:',
          contact: {
            email: 'eric.silverstein@icloud.com',
            subject: 'Data Protection Officer / Privacy Inquiry',
          },
        },
        {
          title: '13. Complaint Rights',
          content:
            'You have the right to lodge a complaint with your local data protection authority if you believe we have violated your privacy rights. You can find contact information for your local authority at https://edpb.ec.europa.eu/about-edpb/board/members_en.',
        },
      ],
    },
    fr: {
      title: 'Politique de Confidentialité',
      lastUpdated: 'Dernière mise à jour : février 2026',
      introduction:
        'Paw Cities (« nous », « notre » ou « la Société ») s\'engage à protéger votre vie privée et à vous offrir une expérience positive sur notre site web et nos services. Cette Politique de Confidentialité explique comment nous collectons, utilisons, divulguons et protégeons vos informations conformément au Règlement Général sur la Protection des Données (RGPD) et à d\'autres lois applicables sur la protection de la vie privée.',
      sections: [
        {
          title: '1. Informations que nous collectons',
          subsections: [
            {
              subtitle: 'Informations de compte',
              content:
                'Lorsque vous créez un compte, nous collectons votre nom, adresse e-mail, mot de passe et informations de profil. Ces informations sont nécessaires pour créer et maintenir votre compte.',
            },
            {
              subtitle: 'Informations de profil de chien',
              content:
                'Si vous choisissez de créer des profils de chien, nous collectons des informations sur vos chiens, y compris leur nom, race, âge, taille, traits de personnalité et photos. Ces informations aident à personnaliser votre expérience.',
            },
            {
              subtitle: 'Données d\'utilisation',
              content:
                'Nous collectons automatiquement des informations sur la façon dont vous interagissez avec notre plateforme, y compris les pages visitées, les établissements consultés, les avis rédigés, les enregistrements effectués et les favoris enregistrés.',
            },
            {
              subtitle: 'Données de localisation',
              content:
                'Si vous activez les services de localisation, nous pouvons collecter votre localisation géographique approximative pour afficher les établissements accueillant les chiens à proximité.',
            },
            {
              subtitle: 'Informations sur l\'appareil',
              content:
                'Nous collectons des informations sur les appareils que vous utilisez pour accéder à notre plateforme, y compris le type d\'appareil, le système d\'exploitation, le type de navigateur et les identifiants uniques.',
            },
            {
              subtitle: 'Cookies et suivi',
              content:
                'Nous utilisons des cookies, des balises Web et d\'autres technologies de suivi similaires pour personnaliser votre expérience et comprendre les modèles d\'utilisation.',
            },
          ],
        },
        {
          title: '2. Comment nous utilisons vos informations',
          content:
            'Nous utilisons les informations que nous collectons pour les fins suivantes :',
          list: [
            'Fournir et améliorer nos services',
            'Créer et gérer votre compte',
            'Personnaliser votre expérience et afficher des établissements pertinents',
            'Traiter et gérer vos avis, enregistrements et favoris',
            'Communiquer avec vous au sujet de votre compte et des mises à jour',
            'Répondre à vos demandes de support client',
            'Mener des recherches et analyses pour améliorer notre plateforme',
            'Détecter et prévenir la fraude et les abus',
            'Nous conformer aux obligations légales',
          ],
        },
        {
          title: '3. Base légale du traitement (RGPD)',
          content:
            'Nous traitons vos données personnelles sur les bases légales suivantes :',
          list: [
            'Consentement : Lorsque vous avez explicitement consenti au traitement',
            'Exécution du contrat : Pour fournir les services que vous avez demandés',
            'Obligation légale : Pour nous conformer aux lois et réglementations applicables',
            'Intérêts légitimes : Pour améliorer nos services et prévenir la fraude',
            'Intérêts vitaux : Pour protéger votre santé et sécurité',
          ],
        },
        {
          title: '4. Prestataires de services tiers',
          subsections: [
            {
              subtitle: 'Supabase',
              content:
                'Nous utilisons Supabase pour les services d\'authentification et de base de données. Supabase est certifié comme un processeur conforme au RGPD.',
            },
            {
              subtitle: 'Stripe',
              content:
                'Si applicable, nous utilisons Stripe pour le traitement des paiements. Stripe est conforme aux normes PCI-DSS.',
            },
            {
              subtitle: 'Cloudinary',
              content:
                'Nous utilisons Cloudinary pour stocker, optimiser et livrer les images. Cloudinary respecte la conformité RGPD.',
            },
            {
              subtitle: 'Analytics tiers',
              content:
                'Nous pouvons utiliser des services d\'analyse pour comprendre les modèles d\'utilisation et améliorer notre plateforme.',
            },
          ],
        },
        {
          title: '5. Conservation des données',
          content:
            'Nous conservons vos données personnelles aussi longtemps que nécessaire pour fournir nos services. Spécifiquement :',
          list: [
            'Les données de compte sont conservées tandis que votre compte est actif',
            'Les données d\'utilisation sont conservées jusqu\'à 12 mois',
            'Les informations de profil de chien sont conservées jusqu\'à suppression',
            'Les avis sont conservés indéfiniment, sauf demande de suppression',
            'Les données de localisation ne sont pas stockées de façon permanente',
            'À la suppression du compte, les données personnelles sont anonymisées dans les 30 jours',
          ],
        },
        {
          title: '6. Vos droits au titre du RGPD',
          content:
            'En vertu du RGPD, vous disposez des droits suivants concernant vos données personnelles :',
          subsections: [
            {
              subtitle: 'Droit d\'accès',
              content:
                'Vous avez le droit de demander une copie de toutes les données personnelles que nous détenons à votre sujet.',
            },
            {
              subtitle: 'Droit de rectification',
              content:
                'Vous avez le droit de corriger les données personnelles inexactes ou incomplètes.',
            },
            {
              subtitle: 'Droit à l\'effacement',
              content:
                'Vous avez le droit de demander la suppression de vos données personnelles. Nous supprimerons votre compte dans les 30 jours.',
            },
            {
              subtitle: 'Droit à la portabilité des données',
              content:
                'Vous avez le droit de recevoir vos données personnelles dans un format structuré et lisible par machine.',
            },
            {
              subtitle: 'Droit de restriction du traitement',
              content:
                'Vous avez le droit de restreindre notre traitement de vos données personnelles.',
            },
            {
              subtitle: 'Droit d\'opposition',
              content:
                'Vous avez le droit de vous opposer au traitement de vos données à titre de communications marketing.',
            },
            {
              subtitle: 'Droits relatifs à la prise de décision automatisée',
              content:
                'Nous n\'utilisons pas vos données pour une prise de décision automatisée sans votre consentement.',
            },
          ],
        },
        {
          title: '7. Sécurité des données',
          content:
            'Nous mettons en place des mesures techniques et organisationnelles pour protéger vos données personnelles :',
          list: [
            'Chiffrement des données en transit (HTTPS/TLS)',
            'Chiffrement des données sensibles au repos',
            'Mécanismes d\'authentification sécurisés',
            'Audits de sécurité réguliers',
            'Contrôles d\'accès limitant l\'accès aux données',
            'Procédures de sauvegarde et de récupération sécurisées',
            'Plan de réponse aux incidents de violation de données',
          ],
        },
        {
          title: '8. Transferts internationaux de données',
          content:
            'Si nous transférons des données personnelles en dehors de l\'Espace économique européen (EEE), nous mettrons en place des garanties appropriées pour assurer un niveau de protection adéquat.',
        },
        {
          title: '9. Cookies et technologies de suivi',
          subsections: [
            {
              subtitle: 'Cookies essentiels',
              content:
                'Ces cookies sont nécessaires pour l\'authentification et la sécurité. Ils ne peuvent pas être désactivés.',
            },
            {
              subtitle: 'Cookies fonctionnels',
              content:
                'Ces cookies se souviennent de vos préférences et paramètres de personnalisation.',
            },
            {
              subtitle: 'Cookies d\'analyse',
              content:
                'Ces cookies nous aident à comprendre comment vous utilisez notre plateforme.',
            },
            {
              subtitle: 'Cookies marketing',
              content:
                'Nous n\'utilisons pas de cookies marketing ou publicitaires pour le moment.',
            },
          ],
        },
        {
          title: '10. Confidentialité des enfants',
          content:
            'Paw Cities n\'est pas destiné aux enfants de moins de 13 ans. Si nous découvrons que nous avons collecté des données d\'un enfant de moins de 13 ans, nous les supprimerons immédiatement.',
        },
        {
          title: '11. Modifications de cette politique de confidentialité',
          content:
            'Nous pouvons mettre à jour cette Politique de Confidentialité régulièrement pour refléter les changements dans nos pratiques et réglementations. Votre utilisation continue de Paw Cities après les modifications constitue votre acceptation de la Politique de Confidentialité mise à jour.',
        },
        {
          title: '12. Informations de contact & Délégué à la Protection des Données',
          content:
            'Si vous avez des questions sur cette Politique de Confidentialité ou souhaitez exercer vos droits au titre du RGPD, veuillez nous contacter :',
          contact: {
            email: 'eric.silverstein@icloud.com',
            subject: 'Délégué à la Protection des Données / Demande de Confidentialité',
          },
        },
        {
          title: '13. Droits de réclamation',
          content:
            'Vous avez le droit de déposer une réclamation auprès de votre autorité locale de protection des données si vous pensez que nous avons violé vos droits à la vie privée.',
        },
      ],
    },
  };

  const currentContent = content[language];

  return (
    <div className="min-h-screen bg-white">
      {/* Header */}
      <header className="sticky top-0 z-50 w-full border-b bg-white/95 backdrop-blur">
        <div className="container mx-auto px-4">
          <div className="flex h-16 items-center justify-between">
            <Link href="/" className="flex items-center gap-2">
              <span className="text-2xl">🐾</span>
              <span className="font-display text-xl font-bold text-primary-600">
                Paw Cities
              </span>
            </Link>
            <nav className="flex items-center gap-8">
              <Link href="/" className="text-gray-600 hover:text-gray-900">
                Home
              </Link>
              <Link href="/terms" className="text-gray-600 hover:text-gray-900">
                Terms
              </Link>
              <div className="flex gap-2 border-l pl-8">
                <button
                  onClick={() => setLanguage('en')}
                  className={`px-3 py-1 rounded text-sm font-medium transition-colors ${
                    language === 'en'
                      ? 'bg-primary-500 text-white'
                      : 'text-gray-600 hover:text-gray-900'
                  }`}
                >
                  EN
                </button>
                <button
                  onClick={() => setLanguage('fr')}
                  className={`px-3 py-1 rounded text-sm font-medium transition-colors ${
                    language === 'fr'
                      ? 'bg-primary-500 text-white'
                      : 'text-gray-600 hover:text-gray-900'
                  }`}
                >
                  FR
                </button>
              </div>
            </nav>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="container mx-auto px-4 py-12">
        <div className="max-w-4xl mx-auto">
          <h1 className="font-display text-4xl font-bold mb-2">
            {currentContent.title}
          </h1>
          <p className="text-gray-600 mb-8">{currentContent.lastUpdated}</p>

          <div className="prose prose-lg max-w-none">
            <p className="text-gray-700 mb-8 leading-relaxed">
              {currentContent.introduction}
            </p>

            {currentContent.sections.map((section, idx) => (
              <section key={idx} className="mb-10">
                <h2 className="text-2xl font-bold text-gray-900 mb-4">
                  {section.title}
                </h2>

                {section.content && (
                  <p className="text-gray-700 leading-relaxed mb-4">
                    {section.content}
                  </p>
                )}

                {section.list && (
                  <ul className="list-disc list-inside space-y-2 text-gray-700 mb-4">
                    {section.list.map((item, i) => (
                      <li key={i} className="leading-relaxed">
                        {item}
                      </li>
                    ))}
                  </ul>
                )}

                {section.subsections && (
                  <div className="space-y-4">
                    {section.subsections.map((subsection, i) => (
                      <div key={i}>
                        <h3 className="text-lg font-semibold text-gray-900 mb-2">
                          {subsection.subtitle}
                        </h3>
                        <p className="text-gray-700 leading-relaxed">
                          {subsection.content}
                        </p>
                      </div>
                    ))}
                  </div>
                )}

                {section.contact && (
                  <div className="bg-gray-50 border border-gray-200 rounded-lg p-4 mt-4">
                    <p className="text-gray-900">
                      <strong>Email:</strong>{' '}
                      <a
                        href={`mailto:${section.contact.email}?subject=${encodeURIComponent(
                          section.contact.subject
                        )}`}
                        className="text-primary-600 hover:text-primary-700 underline"
                      >
                        {section.contact.email}
                      </a>
                    </p>
                    <p className="text-gray-600 text-sm mt-2">
                      {language === 'en'
                        ? 'Reference: Data Protection Officer / Privacy Inquiry'
                        : 'Référence : Délégué à la Protection des Données / Demande de Confidentialité'}
                    </p>
                  </div>
                )}
              </section>
            ))}
          </div>

          {/* Footer CTA */}
          <div className="mt-16 pt-8 border-t border-gray-200">
            <p className="text-gray-600 mb-4">
              {language === 'en'
                ? 'Have questions about your privacy? Contact our Data Protection Officer.'
                : 'Avez-vous des questions sur votre confidentialité ? Contactez notre Délégué à la Protection des Données.'}
            </p>
            <a
              href={`mailto:eric.silverstein@icloud.com?subject=${encodeURIComponent(
                language === 'en'
                  ? 'Privacy Policy Question'
                  : 'Question sur la Politique de Confidentialité'
              )}`}
              className="inline-flex items-center gap-2 px-6 py-3 bg-primary-500 text-white rounded-lg font-medium hover:bg-primary-600 transition-colors"
            >
              {language === 'en' ? 'Contact DPO' : 'Contacter le DPD'}
            </a>
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="bg-gray-50 border-t mt-16">
        <div className="container mx-auto px-4 py-8">
          <div className="max-w-4xl mx-auto text-center text-gray-600 text-sm">
            <p>
              {language === 'en'
                ? '© 2026 Paw Cities. All rights reserved. | '
                : '© 2026 Paw Cities. Tous droits réservés. | '}
              <Link href="/privacy" className="hover:text-gray-900">
                {language === 'en' ? 'Privacy' : 'Confidentialité'}
              </Link>
              {' | '}
              <Link href="/terms" className="hover:text-gray-900">
                {language === 'en' ? 'Terms' : 'Conditions'}
              </Link>
            </p>
          </div>
        </div>
      </footer>
    </div>
  );
}
