import { HelpCircle, Search, Book, MessageCircle, Mail, Phone, ExternalLink, Star, Clock, CheckCircle, X, Send, FileText, Video, Download, ChevronDown, Eye, PlayCircle } from 'lucide-react';
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';

import { BRAND } from '../constants/branding';
import { useApp } from '../context/AppContext';

export default function HelpSupport() {
  const navigate = useNavigate();
  const { currentEmployee: _currentEmployee } = useApp();
  const [loading, setLoading] = useState(false);
  const [activeTab, setActiveTab] = useState('faqs');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [expandedFaq, setExpandedFaq] = useState<number | null>(null);
  const [supportTicket, setSupportTicket] = useState({
    subject: '',
    category: 'general',
    priority: 'medium',
    description: '',
  });
  const [ticketSubmitted, setTicketSubmitted] = useState(false);

  const [faqs, setFaqs] = useState([
    {
      id: 1,
      category: 'general',
      question: 'How do I reset my password?',
      answer: 'To reset your password, go to the login page and click on "Forgot Password". Enter your email address and follow the instructions sent to your email. You can also contact your system administrator for assistance.',
      helpful: 42,
      views: 156,
    },
    {
      id: 2,
      category: 'inventory',
      question: 'How do I add a new product to inventory?',
      answer: 'Navigate to the Inventory page and click on "Add Product". Fill in the required information including product name, SKU, price, quantity, and category. You can also add product images and detailed descriptions. Click "Save" to add the product to your inventory.',
      helpful: 38,
      views: 203,
    },
    {
      id: 3,
      category: 'sales',
      question: 'How do I process a sale at the POS?',
      answer: 'Go to the POS page and scan or manually enter the product barcode. Add items to the cart, apply any discounts if needed, select the payment method, and complete the transaction. The system will automatically update inventory levels and generate a receipt.',
      helpful: 45,
      views: 189,
    },
    {
      id: 4,
      category: 'customers',
      question: 'How do I manage customer information?',
      answer: 'Navigate to the Customers page to view, add, edit, or delete customer records. You can search for customers by name, email, or phone number. Each customer profile includes order history, contact information, and payment preferences.',
      helpful: 31,
      views: 145,
    },
    {
      id: 5,
      category: 'reports',
      question: 'How do I generate sales reports?',
      answer: 'Go to the Reports page and select the type of report you want to generate (sales, inventory, customer, etc.). Choose your date range and any specific filters. The system will generate a detailed report that can be exported to PDF or Excel format.',
      helpful: 28,
      views: 167,
    },
    {
      id: 6,
      category: 'employees',
      question: 'How do I manage employee accounts?',
      answer: 'Navigate to the Employees page to add, edit, or remove employee accounts. You can set different permission levels, track employee performance, and manage schedules. Each employee has their own login credentials and access based on their role.',
      helpful: 25,
      views: 134,
    },
    {
      id: 7,
      category: 'general',
      question: 'What are the system requirements?',
      answer: 'The system works on any modern web browser (Chrome, Firefox, Safari, Edge) with an internet connection. For mobile devices, we recommend using the latest version of your mobile browser. The system is cloud-based, so no local installation is required.',
      helpful: 33,
      views: 198,
    },
    {
      id: 8,
      category: 'security',
      question: 'How secure is my data?',
      answer: 'We use industry-standard encryption to protect your data both in transit and at rest. Regular backups are performed, and we comply with data protection regulations. Access to your data is controlled through user permissions and two-factor authentication.',
      helpful: 47,
      views: 176,
    },
  ]);

  const [tutorials] = useState([
    {
      id: 1,
      title: 'Getting Started with Inventory Management',
      description: 'Learn the basics of managing your inventory, adding products, and tracking stock levels.',
      duration: '5 min',
      level: 'Beginner',
    },
    {
      id: 2,
      title: 'Processing Sales at POS',
      description: 'Complete guide to using the Point of Sale system, including payment processing and receipts.',
      duration: '8 min',
      level: 'Beginner',
    },
    {
      id: 3,
      title: 'Customer Management Best Practices',
      description: 'Tips and tricks for effectively managing customer relationships and data.',
      duration: '6 min',
      level: 'Intermediate',
    },
    {
      id: 4,
      title: 'Generating and Analyzing Reports',
      description: 'How to create comprehensive reports and use data to make business decisions.',
      duration: '10 min',
      level: 'Intermediate',
    },
    {
      id: 5,
      title: 'Employee Management and Permissions',
      description: 'Setting up employee accounts and managing access levels and permissions.',
      duration: '7 min',
      level: 'Advanced',
    },
    {
      id: 6,
      title: 'System Configuration and Settings',
      description: 'Customizing the system to meet your specific business needs and preferences.',
      duration: '12 min',
      level: 'Advanced',
    },
  ]);

  const [contactMethods] = useState([
    {
      icon: Mail,
      title: 'Email Support',
      description: 'Get help via email',
      value: BRAND.supportEmail,
      responseTime: '24-48 hours',
      color: 'blue',
    },
    {
      icon: MessageCircle,
      title: 'WhatsApp',
      description: 'Chat with our team',
      value: BRAND.supportWhatsApp,
      responseTime: '2-4 hours',
      color: 'green',
    },
    {
      icon: Phone,
      title: 'Phone Support',
      description: 'Call us directly',
      value: '+961 1 234 567',
      responseTime: 'Mon-Fri 9AM-5PM',
      color: 'purple',
    },
  ]);

  const tabs = [
    { id: 'faqs', label: 'FAQs', icon: HelpCircle },
    { id: 'tutorials', label: 'Tutorials', icon: Video },
    { id: 'contact', label: 'Contact Support', icon: MessageCircle },
    { id: 'documentation', label: 'Documentation', icon: Book },
  ];

  const categories = [
    { value: 'all', label: 'All Categories' },
    { value: 'general', label: 'General' },
    { value: 'inventory', label: 'Inventory' },
    { value: 'sales', label: 'Sales' },
    { value: 'customers', label: 'Customers' },
    { value: 'employees', label: 'Employees' },
    { value: 'reports', label: 'Reports' },
    { value: 'security', label: 'Security' },
  ];

  const filteredFaqs = faqs.filter(faq => {
    const matchesSearch = faq.question.toLowerCase().includes(searchQuery.toLowerCase()) ||
                         faq.answer.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesCategory = selectedCategory === 'all' || faq.category === selectedCategory;
    return matchesSearch && matchesCategory;
  });

  const handleTicketSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!supportTicket.subject || !supportTicket.description) {
      toast.error('Please fill in subject and description');
      return;
    }
    setLoading(true);
    await new Promise(resolve => setTimeout(resolve, 1000));
    setLoading(false);
    setTicketSubmitted(true);
    // Open mailto as fallback so message is never lost
    const mailto = `mailto:kits.tech.co@gmail.com?subject=${encodeURIComponent(`[Support] ${supportTicket.subject}`)}&body=${encodeURIComponent(`Category: ${supportTicket.category}\nPriority: ${supportTicket.priority}\n\n${supportTicket.description}`)}`;
    window.open(mailto, '_blank');
    setTimeout(() => {
      setTicketSubmitted(false);
      setSupportTicket({ subject: '', category: 'general', priority: 'medium', description: '' });
    }, 4000);
  };

  const handleFaqHelpful = (faqId: number, helpful: boolean) => {
    // Update helpful count
    setFaqs(prev => prev.map(faq =>
      faq.id === faqId
        ? { ...faq, helpful: faq.helpful + (helpful ? 1 : 0) }
        : faq,
    ));
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 text-slate-100 pb-20 lg:pb-0">
      <div className="max-w-7xl mx-auto p-6">
        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold text-white mb-2">Help & Support</h1>
              <p className="text-white/60">Get help with your Kits business management system</p>
            </div>
            <button
              onClick={() => navigate('/dashboard')}
              className="flex items-center gap-2 px-4 py-2 text-white/60 hover:text-white transition-colors"
            >
              <X className="h-5 w-5" />
              Back to Dashboard
            </button>
          </div>
        </div>

        {/* Quick Contact Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
          {contactMethods.map((method, index) => {
            const Icon = method.icon;
            return (
              <div key={index} className="bg-slate-800/50 backdrop-blur-xl border border-white/10 rounded-2xl p-6 hover:border-white/20 transition-colors">
                <div className="flex items-center gap-4 mb-4">
                  <div className={`h-12 w-12 rounded-xl bg-${method.color}-500/20 flex items-center justify-center`}>
                    <Icon className={`h-6 w-6 text-${method.color}-400`} />
                  </div>
                  <div>
                    <h3 className="text-lg font-semibold text-white">{method.title}</h3>
                    <p className="text-sm text-white/60">{method.description}</p>
                  </div>
                </div>
                <div className="space-y-2">
                  <p className="text-white font-medium">{method.value}</p>
                  <div className="flex items-center gap-2 text-sm text-white/60">
                    <Clock className="h-3 w-3" />
                    <span>{method.responseTime}</span>
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        {/* Navigation Tabs */}
        <div className="bg-slate-800/50 backdrop-blur-xl border border-white/10 rounded-2xl p-6 mb-6">
          <div className="flex flex-wrap gap-2">
            {tabs.map((tab) => {
              const Icon = tab.icon;
              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`flex items-center gap-2 px-4 py-2 rounded-lg transition-colors ${
                    activeTab === tab.id
                      ? 'bg-indigo-500 text-white'
                      : 'text-white/60 hover:bg-white/10 hover:text-white'
                  }`}
                >
                  <Icon className="h-4 w-4" />
                  <span className="text-sm font-medium">{tab.label}</span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Tab Content */}
        <div className="bg-slate-800/50 backdrop-blur-xl border border-white/10 rounded-2xl p-6">
          {/* FAQs Tab */}
          {activeTab === 'faqs' && (
            <div className="space-y-6">
              <div>
                <h2 className="text-xl font-semibold text-white mb-6">Frequently Asked Questions</h2>

                {/* Search and Filter */}
                <div className="flex flex-col lg:flex-row gap-4 mb-6">
                  <div className="flex-1">
                    <div className="relative">
                      <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-white/40" />
                      <input
                        type="text"
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        placeholder="Search FAQs..."
                        className="w-full pl-10 pr-4 py-2 bg-white/5 border border-white/10 rounded-lg text-white placeholder-white/40 focus:outline-none focus:ring-2 focus:ring-indigo-500/50 focus:border-indigo-500/50"
                      />
                    </div>
                  </div>
                  <select
                    value={selectedCategory}
                    onChange={(e) => setSelectedCategory(e.target.value)}
                    className="px-4 py-2 bg-white/5 border border-white/10 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-indigo-500/50 focus:border-indigo-500/50"
                  >
                    {categories.map(category => (
                      <option key={category.value} value={category.value} className="bg-slate-800 text-white">
                        {category.label}
                      </option>
                    ))}
                  </select>
                </div>

                {/* FAQ List */}
                <div className="space-y-4">
                  {filteredFaqs.map((faq) => (
                    <div key={faq.id} className="border border-white/10 rounded-lg overflow-hidden">
                      <button
                        onClick={() => setExpandedFaq(expandedFaq === faq.id ? null : faq.id)}
                        className="w-full px-6 py-4 text-left hover:bg-white/5 transition-colors"
                      >
                        <div className="flex items-center justify-between">
                          <h3 className="text-white font-medium">{faq.question}</h3>
                          <ChevronDown className={`h-4 w-4 text-white/60 transition-transform ${
                            expandedFaq === faq.id ? 'rotate-180' : ''
                          }`} />
                        </div>
                        <div className="flex items-center gap-4 mt-2 text-sm text-white/60">
                          <span className="capitalize">{faq.category}</span>
                          <div className="flex items-center gap-1">
                            <Eye className="h-3 w-3" />
                            <span>{faq.views}</span>
                          </div>
                          <div className="flex items-center gap-1">
                            <Star className="h-3 w-3" />
                            <span>{faq.helpful}</span>
                          </div>
                        </div>
                      </button>
                      {expandedFaq === faq.id && (
                        <div className="px-6 py-4 border-t border-white/10">
                          <p className="text-white/80 mb-4">{faq.answer}</p>
                          <div className="flex items-center gap-4">
                            <span className="text-sm text-white/60">Was this helpful?</span>
                            <div className="flex gap-2">
                              <button
                                onClick={() => handleFaqHelpful(faq.id, true)}
                                className="flex items-center gap-1 px-3 py-1 text-sm bg-green-500/20 text-green-400 rounded-lg hover:bg-green-500/30 transition-colors"
                              >
                                <CheckCircle className="h-3 w-3" />
                                Yes
                              </button>
                              <button
                                onClick={() => handleFaqHelpful(faq.id, false)}
                                className="flex items-center gap-1 px-3 py-1 text-sm bg-red-500/20 text-red-400 rounded-lg hover:bg-red-500/30 transition-colors"
                              >
                                <X className="h-3 w-3" />
                                No
                              </button>
                            </div>
                          </div>
                        </div>
                      )}
                    </div>
                  ))}
                </div>

                {filteredFaqs.length === 0 && (
                  <div className="text-center py-12">
                    <HelpCircle className="h-12 w-12 text-white/20 mx-auto mb-4" />
                    <p className="text-white/60">No FAQs found matching your search</p>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Tutorials Tab */}
          {activeTab === 'tutorials' && (
            <div className="space-y-6">
              <div>
                <h2 className="text-xl font-semibold text-white mb-6">Video Tutorials</h2>

                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                  {tutorials.map((tutorial) => (
                    <div key={tutorial.id} className="border border-white/10 rounded-lg overflow-hidden hover:border-white/20 transition-colors">
                      <button
                        className="w-full aspect-video bg-gradient-to-br from-indigo-500/20 to-purple-500/20 flex flex-col items-center justify-center gap-2 group"
                        onClick={() => toast.info('Video coming soon', { description: 'We\'re preparing tutorial videos. Check back soon!' })}
                      >
                        <PlayCircle className="h-12 w-12 text-white/50 group-hover:text-white/80 transition-colors" />
                        <span className="text-xs text-white/40 group-hover:text-white/60 transition-colors">Coming soon</span>
                      </button>
                      <div className="p-4">
                        <h3 className="text-white font-medium mb-2">{tutorial.title}</h3>
                        <p className="text-white/60 text-sm mb-4">{tutorial.description}</p>
                        <div className="flex items-center justify-between text-sm">
                          <div className="flex items-center gap-2 text-white/60">
                            <Clock className="h-3 w-3" />
                            <span>{tutorial.duration}</span>
                          </div>
                          <span className={`px-2 py-1 rounded-full text-xs ${
                            tutorial.level === 'Beginner' ? 'bg-green-500/20 text-green-400' :
                              tutorial.level === 'Intermediate' ? 'bg-yellow-500/20 text-yellow-400' :
                                'bg-red-500/20 text-red-400'
                          }`}>
                            {tutorial.level}
                          </span>
                        </div>
                        <button
                          className="w-full mt-4 px-4 py-2 bg-indigo-500 text-white rounded-lg hover:bg-indigo-600 transition-colors"
                          onClick={() => toast.info('Video coming soon', { description: 'We\'re preparing tutorial videos. Check back soon!' })}
                        >
                          Watch Tutorial
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* Contact Support Tab */}
          {activeTab === 'contact' && (
            <div className="space-y-6">
              <div>
                <h2 className="text-xl font-semibold text-white mb-6">Submit a Support Ticket</h2>

                {ticketSubmitted ? (
                  <div className="text-center py-12">
                    <CheckCircle className="h-12 w-12 text-green-400 mx-auto mb-4" />
                    <h3 className="text-lg font-semibold text-white mb-2">Ticket Submitted Successfully!</h3>
                    <p className="text-white/60">We'll get back to you within 24-48 hours.</p>
                  </div>
                ) : (
                  <form onSubmit={handleTicketSubmit} className="space-y-6">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      <div>
                        <label className="block text-sm font-medium text-white/80 mb-2">Subject</label>
                        <input
                          type="text"
                          value={supportTicket.subject}
                          onChange={(e) => setSupportTicket(prev => ({ ...prev, subject: e.target.value }))}
                          required
                          className="w-full px-4 py-2 bg-white/5 border border-white/10 rounded-lg text-white placeholder-white/40 focus:outline-none focus:ring-2 focus:ring-indigo-500/50 focus:border-indigo-500/50"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-white/80 mb-2">Category</label>
                        <select
                          value={supportTicket.category}
                          onChange={(e) => setSupportTicket(prev => ({ ...prev, category: e.target.value }))}
                          className="w-full px-4 py-2 bg-white/5 border border-white/10 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-indigo-500/50 focus:border-indigo-500/50"
                        >
                          <option value="general" className="bg-slate-800 text-white">General</option>
                          <option value="technical" className="bg-slate-800 text-white">Technical</option>
                          <option value="billing" className="bg-slate-800 text-white">Billing</option>
                          <option value="feature" className="bg-slate-800 text-white">Feature Request</option>
                          <option value="bug" className="bg-slate-800 text-white">Bug Report</option>
                        </select>
                      </div>
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-white/80 mb-2">Priority</label>
                      <div className="flex gap-4">
                        {['low', 'medium', 'high', 'urgent'].map((priority) => (
                          <label key={priority} className="flex items-center gap-2 cursor-pointer">
                            <input
                              type="radio"
                              value={priority}
                              checked={supportTicket.priority === priority}
                              onChange={(e) => setSupportTicket(prev => ({ ...prev, priority: e.target.value }))}
                              className="text-indigo-500"
                            />
                            <span className="text-white capitalize">{priority}</span>
                          </label>
                        ))}
                      </div>
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-white/80 mb-2">Description</label>
                      <textarea
                        value={supportTicket.description}
                        onChange={(e) => setSupportTicket(prev => ({ ...prev, description: e.target.value }))}
                        rows={6}
                        required
                        className="w-full px-4 py-2 bg-white/5 border border-white/10 rounded-lg text-white placeholder-white/40 focus:outline-none focus:ring-2 focus:ring-indigo-500/50 focus:border-indigo-500/50 resize-none"
                      />
                    </div>

                    <div className="flex justify-end">
                      <button
                        type="submit"
                        disabled={loading}
                        className="flex items-center gap-2 px-6 py-2 bg-indigo-500 text-white rounded-lg hover:bg-indigo-600 transition-colors disabled:opacity-50"
                      >
                        <Send className="h-4 w-4" />
                        {loading ? 'Submitting...' : 'Submit Ticket'}
                      </button>
                    </div>
                  </form>
                )}
              </div>
            </div>
          )}

          {/* Documentation Tab */}
          {activeTab === 'documentation' && (
            <div className="space-y-6">
              <div>
                <h2 className="text-xl font-semibold text-white mb-6">Documentation</h2>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="border border-white/10 rounded-lg p-6 hover:border-white/20 transition-colors">
                    <div className="flex items-center gap-3 mb-4">
                      <Book className="h-6 w-6 text-indigo-400" />
                      <h3 className="text-lg font-medium text-white">User Manual</h3>
                    </div>
                    <p className="text-white/60 mb-4">Complete guide to using all features of the Kits business management system.</p>
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-white/60">Coming soon</span>
                      <button
                        onClick={() => toast.info('Coming soon', { description: 'The user manual is being prepared.' })}
                        className="flex items-center gap-2 px-3 py-1 bg-indigo-500 text-white rounded-lg hover:bg-indigo-600 transition-colors"
                      >
                        <Download className="h-3 w-3" />
                        Download
                      </button>
                    </div>
                  </div>

                  <div className="border border-white/10 rounded-lg p-6 hover:border-white/20 transition-colors">
                    <div className="flex items-center gap-3 mb-4">
                      <FileText className="h-6 w-6 text-green-400" />
                      <h3 className="text-lg font-medium text-white">API Documentation</h3>
                    </div>
                    <p className="text-white/60 mb-4">Technical documentation for developers integrating with our API.</p>
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-white/60">Online • Interactive</span>
                      <button
                        onClick={() => toast.info('Coming soon', { description: 'API documentation is being prepared.' })}
                        className="flex items-center gap-2 px-3 py-1 bg-green-500 text-white rounded-lg hover:bg-green-600 transition-colors"
                      >
                        <ExternalLink className="h-3 w-3" />
                        View Online
                      </button>
                    </div>
                  </div>

                  <div className="border border-white/10 rounded-lg p-6 hover:border-white/20 transition-colors">
                    <div className="flex items-center gap-3 mb-4">
                      <Video className="h-6 w-6 text-purple-400" />
                      <h3 className="text-lg font-medium text-white">Video Library</h3>
                    </div>
                    <p className="text-white/60 mb-4">Collection of video tutorials and walkthroughs for all major features.</p>
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-white/60">Coming soon</span>
                      <button
                        onClick={() => toast.info('Coming soon', { description: 'Tutorial videos are being recorded.' })}
                        className="flex items-center gap-2 px-3 py-1 bg-purple-500 text-white rounded-lg hover:bg-purple-600 transition-colors"
                      >
                        <Video className="h-3 w-3" />
                        Watch Now
                      </button>
                    </div>
                  </div>

                  <div className="border border-white/10 rounded-lg p-6 hover:border-white/20 transition-colors">
                    <div className="flex items-center gap-3 mb-4">
                      <HelpCircle className="h-6 w-6 text-yellow-400" />
                      <h3 className="text-lg font-medium text-white">Quick Start Guide</h3>
                    </div>
                    <p className="text-white/60 mb-4">Get up and running quickly with our step-by-step setup guide.</p>
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-white/60">Coming soon</span>
                      <button
                        onClick={() => toast.info('Coming soon', { description: 'The quick start guide is being prepared.' })}
                        className="flex items-center gap-2 px-3 py-1 bg-yellow-500 text-white rounded-lg hover:bg-yellow-600 transition-colors"
                      >
                        <Download className="h-3 w-3" />
                        Download
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}