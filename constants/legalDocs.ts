export interface LegalSection {
  heading: string;
  body: string;
}

export const PRIVACY_POLICY_UPDATED = 'Last updated: July 2026';

export const PRIVACY_POLICY: LegalSection[] = [
  {
    heading: 'Who we are',
    body: 'Compound to Greatness ("C2G", "we", "us") is operated by Lumière Holdings LLC. This policy explains what information we collect, how we use it, and the choices you have.',
  },
  {
    heading: 'Information you provide',
    body: 'When you create an account, we collect your email address, name, and a username. You may optionally add a profile photo, a personal goal, and an identity statement you write yourself. If you choose to save daily progress photos, those are stored on your account.',
  },
  {
    heading: 'Information from your use of the app',
    body: 'We store your daily check-ins, streaks, completed activities, and challenge history so the app can track your progress. If you invite friends to watch your journey or connect with other users, we store those connections and any messages, reactions, or encouragements exchanged through the app.',
  },
  {
    heading: 'What other people can see',
    body: 'By default, people you invite as "watchers" can see your streak, badges, and activity status. You control an additional setting, Share Full Journey, which determines whether watchers can also see your identity statement and progress photos. You can turn this off at any time in Settings.',
  },
  {
    heading: 'Notifications',
    body: 'If you enable reminders, we use your device\'s push notification token to send you daily reminders at the times you choose. You can disable these at any time in Settings or in your device settings.',
  },
  {
    heading: 'Payments',
    body: 'Subscription purchases are processed by Apple\'s App Store or Google Play, and by our subscription management provider (RevenueCat). We do not receive or store your full payment card details — that information is handled entirely by Apple, Google, and our payment processors.',
  },
  {
    heading: 'How we use your information',
    body: 'We use your information to operate the app, maintain your challenge and streak history, enable the social features you opt into, send reminders you\'ve requested, and provide customer support. We do not sell your personal information to third parties.',
  },
  {
    heading: 'Where your data is stored',
    body: 'Your data is stored with our infrastructure providers (including Supabase) on secure cloud servers. We take reasonable technical and organizational measures to protect your information.',
  },
  {
    heading: 'Your choices and rights',
    body: 'You can edit or remove your profile photo, identity statement, and username at any time in Settings. You can turn off Share Full Journey at any time. You can permanently delete your account and all associated data at any time from Settings — this action is immediate and cannot be undone.',
  },
  {
    heading: 'Children\'s privacy',
    body: 'C2G is not directed at children under 13, and we do not knowingly collect personal information from children under 13. If you believe a child has provided us with personal information, please contact us so we can remove it.',
  },
  {
    heading: 'Changes to this policy',
    body: 'We may update this policy from time to time. If we make material changes, we\'ll notify you in the app or by email.',
  },
  {
    heading: 'Contact us',
    body: 'Questions about this policy or your data can be sent to privacy@compoundtogreatness.com.',
  },
];

export const TERMS_UPDATED = 'Last updated: July 2026';

export const TERMS_OF_SERVICE: LegalSection[] = [
  {
    heading: 'Agreement to terms',
    body: 'These Terms of Service govern your use of Compound to Greatness ("C2G"), operated by Lumière Holdings LLC. By creating an account, you agree to these terms.',
  },
  {
    heading: 'The 77-day challenge',
    body: 'C2G is a habit and identity-building tool built around a 77-day challenge structure. Missing a day of your challenge will reset your progress to Day 1, as described in the app\'s Challenge Rules. This is a core mechanic of the product, not an error, and is not eligible for a refund on that basis alone.',
  },
  {
    heading: 'Not medical, financial, or professional advice',
    body: 'C2G is a personal development and habit-tracking tool. Nothing in the app — including identity statements, goal suggestions, or coaching content — constitutes medical, psychological, financial, or professional advice. Consult a qualified professional before making decisions about your health, finances, or wellbeing.',
  },
  {
    heading: 'Your account',
    body: 'You\'re responsible for maintaining the confidentiality of your account credentials and for all activity under your account. You must provide accurate information when creating your account.',
  },
  {
    heading: 'Subscriptions and payments',
    body: 'Certain features require a paid subscription, billed through the Apple App Store or Google Play on a recurring basis until cancelled. You can manage or cancel your subscription through your Apple ID or Google Play account settings. Refunds are handled according to Apple\'s and Google\'s respective refund policies.',
  },
  {
    heading: 'Acceptable use',
    body: 'You agree not to use C2G to harass, abuse, or harm other users; to impersonate any person; to upload unlawful or infringing content; or to interfere with the app\'s normal operation.',
  },
  {
    heading: 'Social features',
    body: 'If you invite others to watch your journey, or if you make your journey public, content you share (including your identity statement and progress photos, if enabled) may be visible to those users. You are responsible for what you choose to share.',
  },
  {
    heading: 'Account deletion',
    body: 'You may delete your account at any time from Settings. This permanently removes your account and associated data and cannot be undone.',
  },
  {
    heading: 'Disclaimer of warranties',
    body: 'C2G is provided "as is" without warranties of any kind, express or implied. We do not guarantee that the app will be uninterrupted, error-free, or that it will achieve any particular personal or financial outcome for you.',
  },
  {
    heading: 'Limitation of liability',
    body: 'To the fullest extent permitted by law, Lumière Holdings LLC will not be liable for any indirect, incidental, or consequential damages arising from your use of the app.',
  },
  {
    heading: 'Governing law',
    body: 'These terms are governed by the laws of the State of Missouri, without regard to its conflict of law principles.',
  },
  {
    heading: 'Changes to these terms',
    body: 'We may update these terms from time to time. Continued use of the app after changes take effect constitutes acceptance of the updated terms.',
  },
  {
    heading: 'Contact us',
    body: 'Questions about these terms can be sent to legal@compoundtogreatness.com.',
  },
];
