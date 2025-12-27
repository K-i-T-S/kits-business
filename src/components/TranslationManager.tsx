import React, { useState, useEffect } from 'react';
import { useTranslationManager } from '../contexts/TranslationContext';
import { useTranslation } from 'react-i18next';
import { supportedLanguages } from '../i18n';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Textarea } from './ui/textarea';
import { Badge } from './ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from './ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './ui/select';
import { 
  Download, 
  Upload, 
  Search, 
  CheckCircle, 
  AlertCircle, 
  Plus, 
  Edit2, 
  Trash2,
  FileText,
  BarChart3
} from 'lucide-react';

export const TranslationManager: React.FC = () => {
  const { t } = useTranslation();
  const {
    missingTranslations,
    addTranslation,
    updateTranslation,
    deleteTranslation,
    clearMissingTranslations,
    getTranslationStats,
    exportTranslations,
    importTranslations,
    validateTranslations,
    searchTranslations
  } = useTranslationManager();

  const [selectedLanguage, setSelectedLanguage] = useState('en');
  const [searchQuery, setSearchQuery] = useState('');
  const [newKey, setNewKey] = useState('');
  const [newValue, setNewValue] = useState('');
  const [editingKey, setEditingKey] = useState('');
  const [editingValue, setEditingValue] = useState('');
  const [stats, setStats] = useState<any[]>([]);
  const [validation, setValidation] = useState<{ valid: boolean; errors: string[] }>({ valid: true, errors: [] });
  const [searchResults, setSearchResults] = useState<any[]>([]);

  useEffect(() => {
    setStats(getTranslationStats());
    setValidation(validateTranslations());
  }, [getTranslationStats, validateTranslations]);

  const handleAddTranslation = () => {
    if (newKey && newValue) {
      addTranslation(newKey, newValue, selectedLanguage);
      setNewKey('');
      setNewValue('');
      setStats(getTranslationStats());
    }
  };

  const handleUpdateTranslation = () => {
    if (editingKey && editingValue) {
      updateTranslation(editingKey, editingValue, selectedLanguage);
      setEditingKey('');
      setEditingValue('');
      setStats(getTranslationStats());
    }
  };

  const handleDeleteTranslation = (key: string) => {
    deleteTranslation(key, selectedLanguage);
    setStats(getTranslationStats());
  };

  const handleExport = () => {
    const data = exportTranslations(selectedLanguage);
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `translations_${selectedLanguage}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleImport = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (e) => {
        try {
          const data = JSON.parse(e.target?.result as string);
          importTranslations(data, selectedLanguage);
          setStats(getTranslationStats());
        } catch (error) {
          console.error('Failed to import translations:', error);
        }
      };
      reader.readAsText(file);
    }
  };

  const handleSearch = () => {
    if (searchQuery) {
      const results = searchTranslations(searchQuery, selectedLanguage);
      setSearchResults(results);
    } else {
      setSearchResults([]);
    }
  };

  const currentLanguageStats = stats.find(s => s.language === selectedLanguage);

  return (
    <div className="space-y-6 p-6">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold">{t('translationManager.title', 'Translation Manager')}</h1>
        <div className="flex items-center gap-2">
          <Select value={selectedLanguage} onValueChange={setSelectedLanguage}>
            <SelectTrigger className="w-40">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {supportedLanguages.map(lang => (
                <SelectItem key={lang.code} value={lang.code}>
                  {lang.nativeName}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Statistics Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <FileText className="h-4 w-4" />
              {t('translationManager.totalKeys', 'Total Keys')}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{currentLanguageStats?.totalKeys || 0}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <CheckCircle className="h-4 w-4 text-green-600" />
              {t('translationManager.translated', 'Translated')}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">
              {currentLanguageStats?.translatedKeys || 0}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <AlertCircle className="h-4 w-4 text-red-600" />
              {t('translationManager.missing', 'Missing')}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-red-600">
              {currentLanguageStats?.missingKeys || 0}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <BarChart3 className="h-4 w-4" />
              {t('translationManager.completion', 'Completion')}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {currentLanguageStats?.completionPercentage || 0}%
            </div>
          </CardContent>
        </Card>
      </div>

      <Tabs defaultValue="add" className="w-full">
        <TabsList className="grid w-full grid-cols-5">
          <TabsTrigger value="add">{t('translationManager.add', 'Add')}</TabsTrigger>
          <TabsTrigger value="edit">{t('translationManager.edit', 'Edit')}</TabsTrigger>
          <TabsTrigger value="missing">{t('translationManager.missing', 'Missing')}</TabsTrigger>
          <TabsTrigger value="search">{t('translationManager.search', 'Search')}</TabsTrigger>
          <TabsTrigger value="tools">{t('translationManager.tools', 'Tools')}</TabsTrigger>
        </TabsList>

        <TabsContent value="add" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>{t('translationManager.addTranslation', 'Add Translation')}</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <label className="text-sm font-medium">{t('translationManager.key', 'Key')}</label>
                <Input
                  value={newKey}
                  onChange={(e) => setNewKey(e.target.value)}
                  placeholder={t('translationManager.enterKey', 'Enter translation key')}
                />
              </div>
              <div>
                <label className="text-sm font-medium">{t('translationManager.value', 'Value')}</label>
                <Textarea
                  value={newValue}
                  onChange={(e) => setNewValue(e.target.value)}
                  placeholder={t('translationManager.enterValue', 'Enter translation value')}
                  rows={3}
                />
              </div>
              <Button onClick={handleAddTranslation} className="flex items-center gap-2">
                <Plus className="h-4 w-4" />
                {t('translationManager.addTranslation', 'Add Translation')}
              </Button>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="edit" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>{t('translationManager.editTranslation', 'Edit Translation')}</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <label className="text-sm font-medium">{t('translationManager.key', 'Key')}</label>
                <Input
                  value={editingKey}
                  onChange={(e) => setEditingKey(e.target.value)}
                  placeholder={t('translationManager.enterKeyToEdit', 'Enter key to edit')}
                />
              </div>
              <div>
                <label className="text-sm font-medium">{t('translationManager.value', 'Value')}</label>
                <Textarea
                  value={editingValue}
                  onChange={(e) => setEditingValue(e.target.value)}
                  placeholder={t('translationManager.enterNewValue', 'Enter new translation value')}
                  rows={3}
                />
              </div>
              <div className="flex gap-2">
                <Button onClick={handleUpdateTranslation} className="flex items-center gap-2">
                  <Edit2 className="h-4 w-4" />
                  {t('translationManager.update', 'Update')}
                </Button>
                <Button 
                  variant="destructive" 
                  onClick={() => handleDeleteTranslation(editingKey)}
                  className="flex items-center gap-2"
                >
                  <Trash2 className="h-4 w-4" />
                  {t('translationManager.delete', 'Delete')}
                </Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="missing" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center justify-between">
                {t('translationManager.missingTranslations', 'Missing Translations')}
                <Badge variant="destructive">{missingTranslations.length}</Badge>
              </CardTitle>
            </CardHeader>
            <CardContent>
              {missingTranslations.length === 0 ? (
                <p className="text-muted-foreground">
                  {t('translationManager.noMissingTranslations', 'No missing translations found')}
                </p>
              ) : (
                <div className="space-y-2">
                  {missingTranslations.map((missing, index) => (
                    <div key={index} className="flex items-center justify-between p-2 border rounded">
                      <div>
                        <span className="font-medium">{missing.key}</span>
                        <span className="text-sm text-muted-foreground ml-2">
                          ({missing.language})
                        </span>
                      </div>
                      <Button
                        size="sm"
                        onClick={() => {
                          setEditingKey(missing.key);
                          setEditingValue('');
                        }}
                      >
                        {t('translationManager.add', 'Add')}
                      </Button>
                    </div>
                  ))}
                  <Button 
                    variant="outline" 
                    onClick={clearMissingTranslations}
                    className="mt-4"
                  >
                    {t('translationManager.clearMissing', 'Clear Missing List')}
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="search" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>{t('translationManager.searchTranslations', 'Search Translations')}</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex gap-2">
                <Input
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder={t('translationManager.searchPlaceholder', 'Search for translations...')}
                  className="flex-1"
                />
                <Button onClick={handleSearch} className="flex items-center gap-2">
                  <Search className="h-4 w-4" />
                  {t('translationManager.search', 'Search')}
                </Button>
              </div>
              {searchResults.length > 0 && (
                <div className="space-y-2">
                  {searchResults.map((result, index) => (
                    <div key={index} className="p-2 border rounded">
                      <div className="font-medium">{result.key}</div>
                      <div className="text-sm text-muted-foreground">{result.description}</div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="tools" className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Download className="h-4 w-4" />
                  {t('translationManager.exportTranslations', 'Export Translations')}
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground mb-4">
                  {t('translationManager.exportDescription', 'Download translations as JSON file')}
                </p>
                <Button onClick={handleExport} className="flex items-center gap-2">
                  <Download className="h-4 w-4" />
                  {t('translationManager.export', 'Export')}
                </Button>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Upload className="h-4 w-4" />
                  {t('translationManager.importTranslations', 'Import Translations')}
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground mb-4">
                  {t('translationManager.importDescription', 'Upload translations from JSON file')}
                </p>
                <input
                  type="file"
                  accept=".json"
                  onChange={handleImport}
                  className="hidden"
                  id="import-file"
                />
                <Button asChild className="flex items-center gap-2">
                  <label htmlFor="import-file" className="cursor-pointer">
                    <Upload className="h-4 w-4" />
                    {t('translationManager.import', 'Import')}
                  </label>
                </Button>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <CheckCircle className="h-4 w-4" />
                  {t('translationManager.validation', 'Validation')}
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  <Badge variant={validation.valid ? "default" : "destructive"}>
                    {validation.valid ? 
                      t('translationManager.valid', 'Valid') : 
                      t('translationManager.invalid', 'Invalid')
                    }
                  </Badge>
                  {validation.errors.length > 0 && (
                    <div className="space-y-1">
                      {validation.errors.map((error, index) => (
                        <div key={index} className="text-sm text-red-600">
                          {error}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>{t('translationManager.languageStats', 'Language Statistics')}</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  {stats.map((stat) => (
                    <div key={stat.language} className="flex items-center justify-between">
                      <span className="font-medium">
                        {supportedLanguages.find(l => l.code === stat.language)?.nativeName || stat.language}
                      </span>
                      <div className="flex items-center gap-2">
                        <div className="w-24 bg-gray-200 rounded-full h-2">
                          <div 
                            className="bg-blue-600 h-2 rounded-full" 
                            style={{ width: `${stat.completionPercentage}%` }}
                          />
                        </div>
                        <span className="text-sm">{stat.completionPercentage}%</span>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
};
