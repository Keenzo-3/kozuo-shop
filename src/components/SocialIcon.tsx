import {
  Globe,
  MessageCircle,
  Send,
  Share2,
  Gamepad2,
  Phone,
  Camera,
  Video,
} from 'lucide-react';
import type { SocialPlatform } from '../types/store';

interface SocialIconProps {
  platform: SocialPlatform;
  className?: string;
}

export function SocialIcon({ platform, className = 'w-4 h-4' }: SocialIconProps) {
  switch (platform) {
    case 'Facebook':
      return <Share2 className={className} />;
    case 'Messenger':
      return <MessageCircle className={className} />;
    case 'Telegram':
      return <Send className={className} />;
    case 'Discord':
      return <Gamepad2 className={className} />;
    case 'TikTok':
      return <Video className={className} />;
    case 'WhatsApp':
      return <Phone className={className} />;
    case 'Instagram':
      return <Camera className={className} />;
    default:
      return <Globe className={className} />;
  }
}
