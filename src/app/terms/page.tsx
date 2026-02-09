'use client';

import Link from 'next/link';
import { useState } from 'react';

export default function TermsPage() {
  const [language, setLanguage] = useState<'en' | 'fr'>('en');

  const content = {
    en: {
      title: 'Terms of Service',
      lastUpdated: 'Last updated: February 2026',
      introduction:
        'These Terms of Service ("Terms") govern your use of the Paw Cities website and services (collectively, the "Service"). By accessing or using Paw Cities, you agree to be bound by these Terms. If you do not agree to any part of these Terms, you may not use our Service.',
      sections: [
        {
          title: '1. Acceptance of Terms',
          content:
            'By using Paw Cities, you represent that you are at least 13 years of age and have the authority to enter into these Terms. If you are using Paw Cities on behalf of a company or organization, you represent that you have the authority to bind that entity to these Terms.',
        },
        {
          title: '2. Use License',
          content:
            'We grant you a limited, non-exclusive, non-transferable, revocable license to access and use Paw Cities for personal, non-commercial purposes. You may not:',
          list: [
            'Reproduce, distribute, or transmit any content from Paw Cities without permission',
            'Modify, adapt, or create derivative works based on Paw Cities',
            'Decompile, reverse engineer, or attempt to discover source code',
            'Rent, lease, or lend access to Paw Cities',
            'Transfer your rights or obligations under this license to any third party',
            'Use Paw Cities in a manner that violates any applicable laws',
          ],
        },
        {
          title: '3. User Accounts',
          content:
            'You are responsible for maintaining the confidentiality of your account credentials and for all activities that occur under your account. You agree to:',
          list: [
            'Provide accurate, current, and complete information when creating your account',
            'Update your information to keep it accurate and current',
            'Notify us immediately of unauthorized access or use of your account',
            'Accept full responsibility for all activities under your account',
            'Not create multiple accounts to circumvent restrictions',
            'Not use another person\'s account without permission',
          ],
        },
        {
          title: '4. Acceptable Use Policy',
          content:
            'You agree not to use Paw Cities in any manner that:',
          list: [
            'Violates any applicable laws, regulations, or third-party rights',
            'Is abusive, threatening, defamatory, obscene, or otherwise offensive',
            'Promotes discrimination, hate, or violence based on protected characteristics',
            'Harasses, intimidates, or bullies other users',
            'Transmits malware, viruses, or any malicious code',
            'Attempts to gain unauthorized access to our systems',
            'Interferes with or disrupts the Service or its infrastructure',
            'Harvests or scrapes data from our platform without authorization',
            'Engages in spam, phishing, or other fraudulent activities',
            'Impersonates another person or misrepresents your affiliation',
            'Violates intellectual property rights of others',
            'Circumvents security measures or access controls',
          ],
        },
        {
          title: '5. Intellectual Property Rights',
          content:
            'All content on Paw Cities, including text, graphics, logos, images, and software, is the property of Paw Cities or its content providers and is protected by international copyright and intellectual property laws. You may not use our intellectual property without express written permission.',
          subsections: [
            {
              subtitle: 'Your Content',
              content:
                'When you submit content to Paw Cities (including reviews, dog profiles, photos, check-ins), you retain ownership of that content. However, you grant Paw Cities a worldwide, royalty-free, perpetual license to use, display, reproduce, modify, and distribute your content within our Service. You represent that your content does not infringe any third-party rights.',
            },
          ],
        },
        {
          title: '6. Business Listings and Establishment Information',
          content:
            'Paw Cities provides information about dog-friendly businesses and establishments. We do not verify or guarantee the accuracy of this information. Business owners and operators may:',
          list: [
            'Claim and manage their establishment listing',
            'Update establishment information and hours',
            'Respond to user reviews',
            'Add photos and manage their business profile',
          ],
          subsections: [
            {
              subtitle: 'Business Accuracy',
              content:
                'Business owners are responsible for ensuring their information is accurate and current. We reserve the right to remove or modify listings that violate our policies or contain misleading information.',
            },
            {
              subtitle: 'No Endorsement',
              content:
                'Paw Cities does not endorse any business or establishment. Inclusion on our platform does not constitute any warranty or recommendation.',
            },
          ],
        },
        {
          title: '7. User Reviews and Ratings',
          content:
            'Users may submit reviews and ratings of establishments. You agree that your reviews:',
          list: [
            'Are truthful and based on your genuine experience',
            'Do not contain defamatory, offensive, or inappropriate content',
            'Do not disclose personal information of others',
            'Do not constitute commercial solicitation or spam',
            'Do not violate any third-party intellectual property rights',
          ],
          subsections: [
            {
              subtitle: 'Review Moderation',
              content:
                'We reserve the right to review, edit, or remove reviews that violate our policy. We may also remove reviews for spam, abuse, or misleading content.',
            },
            {
              subtitle: 'Review Liability',
              content:
                'Paw Cities is not responsible for the accuracy or validity of user reviews. We do not verify reviewers\' experiences or endorse their opinions.',
            },
          ],
        },
        {
          title: '8. Check-ins and Location Data',
          content:
            'When you check in to an establishment on Paw Cities, the check-in may be visible to other users (based on your privacy settings). You are responsible for ensuring you have permission to check in and that your check-in does not violate any third-party rights.',
        },
        {
          title: '9. Disclaimer of Warranties',
          content:
            'Paw Cities is provided on an "AS IS" and "AS AVAILABLE" basis. To the fullest extent permitted by law, we disclaim all warranties, whether express or implied, including but not limited to:',
          list: [
            'Implied warranties of merchantability, fitness for a particular purpose, and non-infringement',
            'Warranties regarding the accuracy, completeness, or timeliness of information',
            'Warranties regarding uninterrupted or error-free operation',
            'Warranties that defects will be corrected or that the Service is free of viruses or malware',
          ],
        },
        {
          title: '10. Limitation of Liability',
          content:
            'To the fullest extent permitted by law, Paw Cities and its officers, directors, employees, and agents shall not be liable for any indirect, incidental, special, consequential, or punitive damages, including but not limited to damages for lost profits, loss of data, or interruption of business, arising from or related to your use of Paw Cities, even if we have been advised of the possibility of such damages.',
          subsections: [
            {
              subtitle: 'Liability Cap',
              content:
                'Our total liability arising from or relating to these Terms shall not exceed the amount you have paid to Paw Cities in the 12 months preceding the claim, or $100 USD, whichever is greater.',
            },
          ],
        },
        {
          title: '11. Indemnification',
          content:
            'You agree to indemnify, defend, and hold harmless Paw Cities and its officers, directors, employees, and agents from and against any and all claims, damages, losses, liabilities, and expenses (including reasonable attorneys\' fees) arising from or related to:',
          list: [
            'Your use of Paw Cities or violation of these Terms',
            'Your violation of any applicable laws or regulations',
            'Your infringement of any third-party intellectual property rights',
            'Your content or submissions to Paw Cities',
            'Your violation of any third-party rights',
          ],
        },
        {
          title: '12. Modification and Termination',
          content:
            'We reserve the right to modify, suspend, or discontinue Paw Cities at any time, with or without notice. We may also modify these Terms at any time. Changes become effective when posted on our website. Your continued use of Paw Cities after modifications constitutes acceptance of the updated Terms.',
          subsections: [
            {
              subtitle: 'Account Termination',
              content:
                'We reserve the right to terminate your account and access to Paw Cities if you violate these Terms or engage in behavior we determine to be harmful to Paw Cities or other users.',
            },
            {
              subtitle: 'Survival',
              content:
                'Sections regarding Acceptable Use Policy, Intellectual Property, Disclaimer of Warranties, Limitation of Liability, Indemnification, and Governing Law shall survive termination of these Terms.',
            },
          ],
        },
        {
          title: '13. Dispute Resolution',
          content:
            'These Terms are governed by and construed in accordance with the laws of Switzerland, without regard to its conflicts of law principles. Any dispute arising from or relating to these Terms shall be resolved exclusively in the courts located in Geneva, Switzerland.',
          subsections: [
            {
              subtitle: 'Binding Arbitration',
              content:
                'By using Paw Cities, you agree that any dispute shall be resolved by binding arbitration administered by arbitration authorities in Geneva, Switzerland, rather than in court, except that you may pursue claims in small claims court if eligible.',
            },
            {
              subtitle: 'Class Action Waiver',
              content:
                'You agree that disputes shall be resolved on an individual basis and not as class action lawsuits. You waive your right to participate in any class action.',
            },
          ],
        },
        {
          title: '14. Third-Party Links and Services',
          content:
            'Paw Cities may contain links to third-party websites and services. We do not control, endorse, or assume responsibility for the content, accuracy, or practices of these third-party sites. Your use of third-party services is subject to their own terms of service and privacy policies.',
        },
        {
          title: '15. Geographic Restrictions',
          content:
            'Paw Cities is operated primarily for users in Europe, particularly Switzerland, France, and the United Kingdom. We make no representation that Paw Cities is accessible or appropriate for use in other locations. If you access Paw Cities from outside these regions, you do so at your own risk and are responsible for compliance with local laws.',
        },
        {
          title: '16. Severability',
          content:
            'If any provision of these Terms is found to be invalid or unenforceable, that provision shall be severed, and the remaining provisions shall continue in full force and effect.',
        },
        {
          title: '17. Entire Agreement',
          content:
            'These Terms, together with our Privacy Policy, constitute the entire agreement between you and Paw Cities regarding your use of our Service and supersede all prior agreements, understandings, and negotiations.',
        },
        {
          title: '18. Contact Information',
          content:
            'If you have questions about these Terms of Service, please contact us at:',
          contact: {
            email: 'eric.silverstein@icloud.com',
            subject: 'Terms of Service Inquiry',
          },
        },
      ],
    },
    fr: {
      title: 'Conditions d\'Utilisation',
      lastUpdated: 'Dernière mise à jour : février 2026',
      introduction:
        'Ces Conditions d\'Utilisation régissent votre utilisation du site web et des services de Paw Cities (collectivement, le « Service »). En accédant ou en utilisant Paw Cities, vous acceptez d\'être lié par ces Conditions. Si vous n\'acceptez pas une partie quelconque de ces Conditions, vous ne pouvez pas utiliser notre Service.',
      sections: [
        {
          title: '1. Acceptation des Conditions',
          content:
            'En utilisant Paw Cities, vous déclarez être âgé d\'au moins 13 ans et avoir le pouvoir de conclure ces Conditions. Si vous utilisez Paw Cities au nom d\'une entreprise ou d\'une organisation, vous déclarez avoir le pouvoir de lier cette entité à ces Conditions.',
        },
        {
          title: '2. Licence d\'utilisation',
          content:
            'Nous vous accordons une licence limitée, non-exclusive, incessible et révocable pour accéder et utiliser Paw Cities à des fins personnelles et non commerciales. Vous ne pouvez pas :',
          list: [
            'Reproduire, distribuer ou transmettre le contenu de Paw Cities sans permission',
            'Modifier, adapter ou créer des travaux dérivés basés sur Paw Cities',
            'Décompiler, procéder à de l\'ingénierie inverse ou tenter de découvrir le code source',
            'Louer, affermer ou prêter l\'accès à Paw Cities',
            'Transférer vos droits ou obligations en vertu de cette licence à un tiers',
            'Utiliser Paw Cities d\'une manière qui viole toute loi applicable',
          ],
        },
        {
          title: '3. Comptes utilisateur',
          content:
            'Vous êtes responsable du maintien de la confidentialité de vos identifiants de compte et de toutes les activités qui se produisent sous votre compte. Vous acceptez :',
          list: [
            'De fournir des informations exactes, actuelles et complètes lors de la création de votre compte',
            'De mettre à jour vos informations pour les tenir à jour',
            'De nous notifier immédiatement de tout accès non autorisé à votre compte',
            'D\'accepter l\'entière responsabilité de toutes les activités de votre compte',
            'De ne pas créer plusieurs comptes pour contourner les restrictions',
            'De ne pas utiliser le compte d\'une autre personne sans permission',
          ],
        },
        {
          title: '4. Politique d\'utilisation acceptable',
          content:
            'Vous acceptez de ne pas utiliser Paw Cities de manière à :',
          list: [
            'Violer toute loi, réglementation ou droit de tiers applicable',
            'Être abusif, menaçant, diffamatoire, obscène ou autrement offensant',
            'Promouvoir la discrimination, la haine ou la violence',
            'Harceler, intimider ou intimider d\'autres utilisateurs',
            'Transmettre des malwares, virus ou code malveillant',
            'Tenter d\'obtenir un accès non autorisé à nos systèmes',
            'Interférer ou perturber le Service ou son infrastructure',
            'Collecter ou parcourir les données de notre plateforme sans autorisation',
            'S\'engager dans du spam, du phishing ou d\'autres activités frauduleuses',
            'Se faire passer pour une autre personne ou misrepresenter vos affiliations',
            'Violer les droits de propriété intellectuelle d\'autrui',
            'Contourner les mesures de sécurité ou les contrôles d\'accès',
          ],
        },
        {
          title: '5. Droits de propriété intellectuelle',
          content:
            'Tout contenu sur Paw Cities, y compris le texte, les graphiques, les logos, les images et les logiciels, est la propriété de Paw Cities ou de ses fournisseurs de contenu et est protégé par les lois internationales sur les droits d\'auteur et la propriété intellectuelle.',
          subsections: [
            {
              subtitle: 'Votre contenu',
              content:
                'Lorsque vous soumettez du contenu à Paw Cities, vous conservez la propriété de ce contenu. Cependant, vous accordez à Paw Cities une licence mondiale, gratuite, perpétuelle pour utiliser, afficher, reproduire, modifier et distribuer votre contenu.',
            },
          ],
        },
        {
          title: '6. Annonces commerciales et informations d\'établissement',
          content:
            'Paw Cities fournit des informations sur les entreprises et établissements accueillant les chiens. Nous ne vérifions ni ne garantissons l\'exactitude de ces informations.',
          list: [
            'Les propriétaires d\'entreprises peuvent réclamer et gérer leurs annonces',
            'Mettre à jour les informations et heures d\'établissement',
            'Répondre aux avis des utilisateurs',
            'Ajouter des photos et gérer le profil de leur entreprise',
          ],
        },
        {
          title: '7. Avis et évaluations des utilisateurs',
          content:
            'Les utilisateurs peuvent soumettre des avis et des évaluations des établissements. Vous acceptez que vos avis :',
          list: [
            'Soient véridiques et basés sur votre expérience authentique',
            'Ne contiennent pas de contenu diffamatoire, offensant ou inapproprié',
            'Ne divulguent pas les informations personnelles d\'autrui',
            'Ne constituent pas une sollicitation commerciale ou du spam',
            'Ne violent pas les droits de propriété intellectuelle de tiers',
          ],
        },
        {
          title: '8. Enregistrements et données de localisation',
          content:
            'Lorsque vous vous enregistrez dans un établissement sur Paw Cities, l\'enregistrement peut être visible pour d\'autres utilisateurs. Vous êtes responsable de veiller à avoir la permission de vous enregistrer.',
        },
        {
          title: '9. Exclusion de garanties',
          content:
            'Paw Cities est fourni en l\'état (« AS IS ») et selon la disponibilité (« AS AVAILABLE »). Dans la mesure maximale permise par la loi, nous déclinons toutes les garanties, explicites ou implicites.',
          list: [
            'Garanties implicites de commercialité et d\'adaptation à un usage particulier',
            'Garanties concernant l\'exactitude ou l\'intégralité des informations',
            'Garanties de fonctionnement ininterrompu ou sans erreur',
            'Garanties que les défauts seront corrigés',
          ],
        },
        {
          title: '10. Limitation de responsabilité',
          content:
            'Dans la mesure maximale permise par la loi, Paw Cities et ses dirigeants, administrateurs, employés et agents ne seront pas responsables des dommages indirects, accessoires, spéciaux ou consécutifs, y compris les dommages liés à la perte de profits ou de données.',
        },
        {
          title: '11. Indemnisation',
          content:
            'Vous acceptez d\'indemniser et de tenir inoffensif Paw Cities de tous les réclamations, dommages, pertes et responsabilités découlant de :',
          list: [
            'Votre utilisation de Paw Cities ou violation de ces Conditions',
            'Votre violation de lois ou réglementations applicables',
            'Votre violation des droits de propriété intellectuelle de tiers',
            'Votre contenu ou soumissions à Paw Cities',
          ],
        },
        {
          title: '12. Modification et résiliation',
          content:
            'Nous nous réservons le droit de modifier, suspendre ou interrompre Paw Cities à tout moment. Les modifications prennent effet lors de leur publication sur notre site web.',
          subsections: [
            {
              subtitle: 'Résiliation du compte',
              content:
                'Nous nous réservons le droit de résilier votre compte si vous violez ces Conditions.',
            },
          ],
        },
        {
          title: '13. Résolution des différends',
          content:
            'Ces Conditions sont régies par les lois de la Suisse, sans égard à ses principes de conflits de lois. Tout différend sera résolu exclusivement par les tribunaux situés à Genève, Suisse.',
        },
        {
          title: '14. Liens vers des tiers',
          content:
            'Paw Cities peut contenir des liens vers des sites web et services tiers. Nous ne contrôlons pas, n\'endossons pas et n\'assumons pas la responsabilité du contenu ou des pratiques de ces sites tiers.',
        },
        {
          title: '15. Restrictions géographiques',
          content:
            'Paw Cities est exploité principalement pour les utilisateurs en Europe, notamment en Suisse, en France et au Royaume-Uni. Si vous accédez à Paw Cities en dehors de ces régions, vous le faites à vos risques et périls.',
        },
        {
          title: '16. Divisibilité',
          content:
            'Si une disposition de ces Conditions est jugée invalide ou inapplicable, cette disposition sera supprimée et les dispositions restantes resteront en vigueur.',
        },
        {
          title: '17. Accord intégral',
          content:
            'Ces Conditions, ainsi que notre Politique de Confidentialité, constituent l\'accord intégral entre vous et Paw Cities et remplacent tous les accords, ententes et négociations antérieurs.',
        },
        {
          title: '18. Informations de contact',
          content:
            'Si vous avez des questions sur ces Conditions d\'Utilisation, veuillez nous contacter à :',
          contact: {
            email: 'eric.silverstein@icloud.com',
            subject: 'Demande relative aux Conditions d\'Utilisation',
          },
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
              <Link href="/privacy" className="text-gray-600 hover:text-gray-900">
                Privacy
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
                  </div>
                )}
              </section>
            ))}
          </div>

          {/* Footer CTA */}
          <div className="mt-16 pt-8 border-t border-gray-200">
            <p className="text-gray-600 mb-4">
              {language === 'en'
                ? 'Have questions about our Terms of Service?'
                : 'Avez-vous des questions sur nos Conditions d\'Utilisation ?'}
            </p>
            <a
              href={`mailto:eric.silverstein@icloud.com?subject=${encodeURIComponent(
                language === 'en'
                  ? 'Terms of Service Question'
                  : 'Question sur les Conditions d\'Utilisation'
              )}`}
              className="inline-flex items-center gap-2 px-6 py-3 bg-primary-500 text-white rounded-lg font-medium hover:bg-primary-600 transition-colors"
            >
              {language === 'en' ? 'Contact Support' : 'Contacter le Support'}
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
