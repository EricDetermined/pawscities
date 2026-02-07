import React from 'react';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Stars } from 'lucide-react';

interface ReviewCardProps {
  id: string;
  title: string;
  content: string;
  rating: number;
  createdAt: Date;
  helpfulCount: number;
  establishment: {
    name: string;
    slug: string;
    city: {
      slug: string;
    };
  };
}

export const ReviewCard: React.FC<ReviewCardProps\\r= ({
  id,
  title,
  content,
  rating,
  createdAt,
  helpfulCount,
  establishment,
}) => {
  return (
    <Card className="mb-4">
      <div className="p-4">
        <div className="flex justify-between items-start mb-2">
          <div>
            <a href={`/${establishment.city.slug}-${establishment.slug}`} className="font-bold text-blue-600 hover:text-blue-800">
              æ “ {establishmµ•¹Ğ¹¹…µ•ô(€€€€€€€€€€€€ğ½„ø(€€€€€€€€€€ğ½‘¥Øø(€€€€€€€€€€ñ	…‘”Ù…É¥…¹Ğô‰½ÕÑ±¥¹”ˆùì­É…Ñ¥¹œ¹Ñ½¥á• Ä¥ô½íÔÍÑ…ÉÌğ½	…‘”ø(€€€€€€€€ğ½‘¥Øø(€€€€€€€€ñ Ì±…ÍÍ9…µ”ô‰™½¹Ğµ‰½±µˆ´ÈˆùíÑ¥Ñ±•ôğ½ Ìø(€€€€€€€€ñÀ±…ÍÍ9…µ”ô‰Ñ•áĞµÉ…ä´ØÀÀˆùí½¹Ñ•¹Ñôğ½Àø(€€€€€€€€ñ‘¥Ø±…ÍÍ9…µ”ô‰™±•à¥Ñ•µÌµ•¹Ñ•È©ÕÍÑ¥™äµ‰•Ñİ••¸µĞ´ĞÑ•áĞµÉ…ä´ÔÀÀˆø(€€€€€€€€€€ñÍÁ…¸±…ÍÍ9…µ”ô‰Ñ•áĞµÍ´ˆùíÑÉ…¹ÍÑ½É¥¹™½Éµ…Ğ¡É•…Ñ•‘Ğ¥ôğ½ÍÁ…¸ø(€€€€€€€€€€ñÍÁ…¸úûƒòNØ!•±Á™Õ°í¡•±Á™Õ±½Õ¹Ñôğ½ÍÁ…¸ø(€€€€€€€€ğ½‘¥Øø(€€€€€€ğ½‘¥Øø(€€€€ğ½…Éø(€€¤ì)ôì