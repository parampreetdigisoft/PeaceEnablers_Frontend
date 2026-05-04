import { Injectable, signal } from '@angular/core';
import { Observable, interval, Subject, takeUntil, BehaviorSubject, map } from 'rxjs';
import {
  ChatMessage,
  ChatResponseDto,
  CountryChatRequestDto
} from '../models/chat/ChatMessage';
import { UserService } from './user.service';
import { CountryVM } from '../models/CountryVM';
import { PillarsVM } from '../models/PillersVM';
import { HttpService } from '../http/http.service';
import { ToasterService } from './toaster.service';
import { ResultResponseDto } from '../models/ResultResponseDto';
import { AIAssistantFAQDto } from '../models/chat/AIAssistantFAQDto';
@Injectable({ providedIn: 'root' })
export class ChatService {

  // ─── State ────────────────────────────────────────────────────────────────
  isOpen          = signal(false);
  isTyping        = signal(false);
  selectedCountry = signal<CountryVM | null>(null);
  selectedPillar  = signal<PillarsVM | null>(null);
  messages        = signal<ChatMessage[]>([]);

  countries = new BehaviorSubject<CountryVM[]>([]);
  pillars   = new BehaviorSubject<PillarsVM[]>([]);
  faqs   = new BehaviorSubject<AIAssistantFAQDto[]>([]);

  // ─── Welcome message ──────────────────────────────────────────────────────
  private readonly welcomeMessage: ChatMessage = {
    id: 'welcome',
    role: 'assistant',
    content: `## Welcome to PeaceMappers\n\nI'm your **Urban Intelligence Assistant**. I can help you analyze:\n\n- **Country peace scores** \n- **Pillar-level breakdowns** and risk factors\n- **Trends and recommendations**\n\nSelect a **country** and **pillar** above for focused insights, or ask me anything!`,
    timestamp: new Date(),
  };

  constructor(
    private http: HttpService,
    private userService: UserService,
    private toaster: ToasterService,
  ) {
    this.messages.set([this.welcomeMessage]);
  }

  // ─── Public API ───────────────────────────────────────────────────────────

  openWithContext(country?: CountryVM, pillar?: PillarsVM): void {
    if (country) this.selectedCountry.set(country);
    if (pillar)  this.selectedPillar.set(pillar);
    this.isOpen.set(true);
  }

  toggleOpen(): void { this.isOpen.update(v => !v); }
  closeChat():  void { this.isOpen.set(false); }

  clearHistory(): void { this.messages.set([this.welcomeMessage]); }

  /** Return top-4 predefined question matches for a user query. */
  filterQuestions(query: string): AIAssistantFAQDto[] {
    if (!query || query.trim().length < 2) return [];
    const q = query.toLowerCase();
    if(this.selectedCountry()){
      return this.faqs.value
      .filter(pq => pq.questionText.toLowerCase().includes(q) && !pq.related.includes('global'))
      .slice(0, 4);
    }
    else {
      return this.faqs.value
      .filter(pq => pq.questionText.toLowerCase().includes(q) && pq.related.includes('global'))
      .slice(0, 4);
    }
  }

  /**
   * Send a user message and return an Observable that emits growing streamed text.
   * Handles both the context-aware API path and a graceful no-context fallback.
   */
  sendMessage(userText: string): Observable<string> {
    const country = this.selectedCountry();
    const pillar  = this.selectedPillar();

    // Add user message
    const userMsg: ChatMessage = {
      id: this.uid(),
      role: 'user',
      content: userText,
      timestamp: new Date(),
    };
    this.messages.update(msgs => [...msgs, userMsg]);
    this.isTyping.set(true);

    return new Observable<string>(observer => {
      const assistantId = this.uid();
      const placeholder: ChatMessage = {
        id: assistantId,
        role: 'assistant',
        content: '',
        timestamp: new Date(),
        isStreaming: true,
      };
      this.messages.update(msgs => [...msgs, placeholder]);

      if (country) {
        // Context-aware path — call real backend
        const payload: CountryChatRequestDto = {
          countryID:    country.countryID,
          pillarID:     pillar?.pillarID ?? 0,
          questionText: userText,
          fAQID:null,
          historyText:null          
        };

        this.askAboutCountry(payload).subscribe({
          next: res => {
            if (res.succeeded) {
              this.typewriterStream(res.result?.responseText ?? '', assistantId, observer);
            } else {
              this.handleError(assistantId, observer, res.errors?.join(', ') ?? 'Unknown error');
            }
          },
          error: () => this.handleError(assistantId, observer, 'Request failed. Please try again.'),
        });
      } else {
        // No country selected — ask user to set context
        const fallback = 'Please select a **country** from the context panel above so I can provide accurate, data-backed insights for your query.';
        this.typewriterStream(fallback, assistantId, observer);
      }
    });
  }

  // ─── Data fetches ─────────────────────────────────────────────────────────

  getFAQDs(): void {
    if (this.faqs.value.length > 0) return;
    this.getAssistantFAQDs().subscribe({
      next: res => this.faqs.next(res.result ?? []),
    });
  }
  getAllCountries(): void {
    if (this.countries.value.length > 0) return;
    this.getAllCountriesByUserId(this.userService?.userInfo?.userID).subscribe({
      next: res => this.countries.next(res.result ?? []),
    });
  }

  getPillars(): void {
    if (this.pillars.value.length > 0) return;
    this.getAllPillars().subscribe({
      next: res => this.pillars.next(res ?? []),
    });
  }

  // ─── Private helpers ──────────────────────────────────────────────────────

  private typewriterStream(
    fullText: string,
    assistantId: string,
    observer: { next(v: string): void; complete(): void },
  ): void {
    let i = 0;
    const speed   = 8; // ms per character
    const destroy$ = new Subject<void>();

    interval(speed)
      .pipe(takeUntil(destroy$))
      .subscribe(() => {
        i++;
        const chunk = fullText.substring(0, i);
        this.updateAssistantMessage(assistantId, chunk, true);
        observer.next(chunk);

        if (i >= fullText.length) {
          destroy$.next();
          destroy$.complete();
          this.finalizeMessage(assistantId);
          this.isTyping.set(false);
          observer.complete();
        }
      });
  }

  private handleError(
    assistantId: string,
    observer: { next(v: string): void; complete(): void },
    message: string,
  ): void {
    this.toaster.showError(message);
    this.updateAssistantMessage(assistantId, `⚠️ ${message}`, false);
    this.finalizeMessage(assistantId);
    this.isTyping.set(false);
    observer.complete();
  }

  private updateAssistantMessage(id: string, content: string, isStreaming: boolean): void {
    this.messages.update(msgs =>
      msgs.map(m => m.id === id ? { ...m, content, isStreaming } : m)
    );
  }

  private finalizeMessage(id: string): void {
    this.messages.update(msgs =>
      msgs.map(m => m.id === id ? { ...m, isStreaming: false } : m)
    );
  }

  private uid(): string {
    return `msg_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
  }

  // ─── HTTP ─────────────────────────────────────────────────────────────────

  private getAllCountriesByUserId(userId: number) {
    return this.http
      .get(`Country/getAllCountryByUserId/${userId}`)
      .pipe(map(x => x as ResultResponseDto<CountryVM[]>));
  }

  private getAllPillars() {
    return this.http
      .get('Pillar/Pillars')
      .pipe(map(x => x as PillarsVM[]));
  }

  private getAssistantFAQDs() {
    return this.http
      .get('chat/getAssistantFAQDs')
      .pipe(map(x => x as ResultResponseDto<AIAssistantFAQDto[]>));
  }
  private askAboutCountry(request: CountryChatRequestDto) {
    return this.http
      .post('chat/askAboutCountry', request)
      .pipe(map(x => x as ResultResponseDto<ChatResponseDto>));
  }
}