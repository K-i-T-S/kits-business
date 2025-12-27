import React, { memo } from 'react';
import { Link } from 'react-router-dom';
import { Mail, MessageCircle, Instagram, PhoneCall } from 'lucide-react';
import { BRAND } from '../constants/branding';

interface SupportCardProps {
  type: 'email' | 'whatsapp' | 'instagram';
}

const SupportCard = memo(({ type }: SupportCardProps) => {
  const configs = {
    email: {
      href: `mailto:${BRAND.supportEmail}`,
      icon: Mail,
      title: 'Email Support',
      description: BRAND.supportEmail,
      accent: 'from-blue-500/20 to-blue-600/20 text-blue-400'
    },
    whatsapp: {
      href: `https://wa.me/${BRAND.supportWhatsApp.replace(/\D/g, '')}`,
      icon: MessageCircle,
      title: 'WhatsApp',
      description: BRAND.supportWhatsApp,
      accent: 'from-green-500/20 to-green-600/20 text-green-400'
    },
    instagram: {
      href: `https://instagram.com/${BRAND.supportInstagram.replace('@', '')}`,
      icon: Instagram,
      title: 'Instagram',
      description: BRAND.supportInstagram,
      accent: 'from-pink-500/20 to-purple-600/20 text-pink-400'
    }
  };

  const config = configs[type];

  return (
    <a
      href={config.href}
      target={type !== 'email' ? '_blank' : undefined}
      rel={type !== 'email' ? 'noopener noreferrer' : undefined}
      className="group flex items-start gap-3 rounded-xl border border-white/10 bg-white/5 p-3 text-white/80 transition-all hover:bg-white/10 hover:border-white/20 hover:shadow-lg support-card"
    >
      <div className={`flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br ${config.accent} transition-transform group-hover:scale-110`}>
        <config.icon className="h-4 w-4" />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-semibold text-white transition-colors group-hover:text-blue-400">{config.title}</p>
        <p className="text-xs text-white/60 truncate">{config.description}</p>
      </div>
    </a>
  );
});

SupportCard.displayName = 'SupportCard';

export default SupportCard;
