export interface AIAssistantFAQDto {
  faqID: number;
  related: string;
  category: string;
  questionText: string;
  answerText?: string | null;
  displayOrder: number;
  isAnsweredFaq: boolean;
}