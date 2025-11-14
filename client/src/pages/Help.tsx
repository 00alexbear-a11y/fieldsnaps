import { HelpCircle, Book, MessageCircle, Mail, ExternalLink } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';

export default function Help() {
  const helpResources = [
    {
      icon: Book,
      title: 'Documentation',
      description: 'Learn how to use FieldSnaps features',
      action: 'View Docs',
      href: '#',
    },
    {
      icon: MessageCircle,
      title: 'Community Forum',
      description: 'Get help from other FieldSnaps users',
      action: 'Visit Forum',
      href: '#',
    },
    {
      icon: Mail,
      title: 'Email Support',
      description: 'Contact our support team',
      action: 'Send Email',
      href: 'mailto:support@fieldsnaps.com',
    },
  ];

  const faqItems = [
    {
      question: 'How do I add team members?',
      answer: 'Go to Settings > Team to invite members to your company.',
    },
    {
      question: 'How do offline uploads work?',
      answer: 'Photos are stored locally and automatically upload when you regain internet connection.',
    },
    {
      question: 'Can I export project photos to PDF?',
      answer: 'Yes! Open any project and tap the export button to generate a PDF report.',
    },
    {
      question: 'How do I track who took which photo?',
      answer: 'Every photo is automatically tagged with the creator\'s name, timestamp, and GPS location.',
    },
  ];

  return (
    <div className="h-full overflow-y-auto bg-background">
      <div className="max-w-4xl mx-auto p-6 space-y-8">
        {/* Header */}
        <div className="space-y-2">
          <div className="flex items-center gap-2">
            <HelpCircle className="h-8 w-8 text-primary" />
            <h1 className="text-xl font-semibold">Help & Support</h1>
          </div>
          <p className="text-muted-foreground">
            Find answers to common questions and get support
          </p>
        </div>

        {/* Help Resources */}
        <div>
          <h2 className="text-xl font-semibold mb-4">Get Help</h2>
          <div className="grid gap-4 md:grid-cols-3">
            {helpResources.map((resource) => (
              <Card key={resource.title} className="hover-elevate">
                <CardHeader>
                  <resource.icon className="h-8 w-8 text-primary mb-2" />
                  <CardTitle className="text-lg">{resource.title}</CardTitle>
                  <CardDescription>{resource.description}</CardDescription>
                </CardHeader>
                <CardContent>
                  <Button
                    variant="outline"
                    className="w-full"
                    asChild
                    data-testid={`help-${resource.title.toLowerCase().replace(/\s+/g, '-')}`}
                  >
                    <a href={resource.href} target="_blank" rel="noopener noreferrer">
                      {resource.action}
                      <ExternalLink className="h-4 w-4 ml-2" />
                    </a>
                  </Button>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>

        {/* FAQ */}
        <div>
          <h2 className="text-xl font-semibold mb-4">Frequently Asked Questions</h2>
          <div className="space-y-4">
            {faqItems.map((item, index) => (
              <Card key={index}>
                <CardHeader>
                  <CardTitle className="text-base">{item.question}</CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-sm text-muted-foreground">{item.answer}</p>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>

        {/* App Version */}
        <div className="text-center text-sm text-muted-foreground pt-8 border-t">
          <p>FieldSnaps v1.0.0</p>
          <p className="mt-1">© 2025 FieldSnaps. All rights reserved.</p>
        </div>
      </div>
    </div>
  );
}
