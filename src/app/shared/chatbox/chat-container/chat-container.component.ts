import {
  Component,
  OnInit,
  OnDestroy,
  ViewChild,
  ElementRef,
  computed,
  signal,
  effect,
  inject,
  ChangeDetectionStrategy,
  ChangeDetectorRef,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Subject, takeUntil } from 'rxjs';
import { MarkdownPipe } from '../../directives/markdown.pipe';
import { ChatService } from 'src/app/core/services/chat.service';
import { MatTooltip } from '@angular/material/tooltip';
import { ChatMessage } from 'src/app/core/models/chat/ChatMessage';
import { NgSelectModule } from '@ng-select/ng-select';
import { PillarsVM } from 'src/app/core/models/PillersVM';
import { CountryVM } from 'src/app/core/models/CountryVM';
import { AIAssistantFAQDto } from 'src/app/core/models/chat/AIAssistantFAQDto';

@Component({
  selector: 'app-chat-container',
  standalone: true,
  imports: [CommonModule, FormsModule, MarkdownPipe, MatTooltip, NgSelectModule],
  templateUrl: './chat-container.component.html',
  styleUrls: ['./chat-container.component.css'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ChatContainerComponent implements OnInit, OnDestroy {

  // ─── DI ───────────────────────────────────────────────────────────────────
  protected chatService = inject(ChatService);
  private cdr           = inject(ChangeDetectorRef);

  // ─── View refs ────────────────────────────────────────────────────────────
  @ViewChild('messagesContainer') messagesContainer!: ElementRef<HTMLDivElement>;
  @ViewChild('inputField')        inputField!: ElementRef<HTMLInputElement>;

  // ─── Local state ──────────────────────────────────────────────────────────
  inputText       = signal('');
  suggestions     = signal<AIAssistantFAQDto[]>([]);
  showSuggestions = signal(false);
  showContextPanel = signal(true);
  unreadCount     = signal(0);

  // ─── Service signal aliases ───────────────────────────────────────────────
  protected isOpen          = this.chatService.isOpen;
  protected isTyping        = this.chatService.isTyping;
  protected messages        = this.chatService.messages;
  protected selectedCountry = this.chatService.selectedCountry;
  protected selectedPillar  = this.chatService.selectedPillar;

  // ─── Computed ─────────────────────────────────────────────────────────────
  protected hasContext = computed(() =>
    !!this.chatService.selectedCountry() || !!this.chatService.selectedPillar()
  );

  protected contextLabel = computed<string | null>(() => {
    const c = this.chatService.selectedCountry();
    const p = this.chatService.selectedPillar();
    if (c && p) return `${c.countryName} · ${p.pillarName}`;
    if (c)      return c.countryName;
    if (p)      return p.pillarName;
    return null;
  });

  // ─── Cleanup ──────────────────────────────────────────────────────────────
  private destroy$ = new Subject<void>();

  constructor() {
    // Auto-scroll whenever messages list grows
    effect(() => {
      const msgs = this.messages();
      if (msgs.length > 0) {
        setTimeout(() => this.scrollToBottom(), 50);
      }
    });

    // Reset unread count & focus input when panel opens
    effect(() => {
      const open = this.isOpen();
      if (open) {
        this.unreadCount.set(0);
        setTimeout(() => this.inputField?.nativeElement?.focus(), 320);
      }
    });

    // Increment unread badge while panel is closed
    effect(() => {
      const msgs = this.messages();
      if (!this.isOpen() && msgs.length > 1) {
        const last = msgs[msgs.length - 1];
        if (last?.role === 'assistant' && !last.isStreaming) {
          this.unreadCount.update(n => n + 1);
        }
      }
    });
  }

  // ─── Lifecycle ────────────────────────────────────────────────────────────
  ngOnInit(): void {
    this.chatService.getAllCountries();
    this.chatService.getPillars();
    this.chatService.getFAQDs();
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  // ─── Toggle & Close ───────────────────────────────────────────────────────
  toggleChat(): void { this.chatService.toggleOpen(); }
  closeChat():  void { this.chatService.closeChat(); }

  // ─── Send ─────────────────────────────────────────────────────────────────
  sendMessage(): void {
    const text = this.inputText().trim();
    if (!text || this.isTyping()) return;

    this.inputText.set('');
    this.showSuggestions.set(false);
    this.suggestions.set([]);

    this.chatService
      .sendMessage(text)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next:     () => { this.scrollToBottom(); this.cdr.markForCheck(); },
        complete: () => { this.scrollToBottom(); this.cdr.markForCheck(); },
        error:    () => this.cdr.markForCheck(),
      });
  }

  selectSuggestion(q: AIAssistantFAQDto): void {
    this.inputText.set(q.questionText);
    this.showSuggestions.set(false);
    this.suggestions.set([]);
    setTimeout(() => this.sendMessage(), 50);
  }

  sendQuickQuestion(text: string): void {
    if (this.isTyping()) return;
    this.inputText.set('');
    this.chatService
      .sendMessage(text)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next:     () => { this.scrollToBottom(); this.cdr.markForCheck(); },
        complete: () => this.cdr.markForCheck(),
        error:    () => this.cdr.markForCheck(),
      });
  }

  // ─── Input events ─────────────────────────────────────────────────────────
  onInputChange(event: Event): void {
    const value = (event.target as HTMLInputElement).value;
    this.inputText.set(value);

    if (value.trim().length >= 2) {
      const filtered = this.chatService.filterQuestions(value);
      this.suggestions.set(filtered);
      this.showSuggestions.set(filtered.length > 0);
    } else {
      this.suggestions.set([]);
      this.showSuggestions.set(false);
    }
  }

  onKeyDown(event: KeyboardEvent): void {
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault();
      this.sendMessage();
    }
    if (event.key === 'Escape') {
      this.showSuggestions.set(false);
    }
  }

  closeSuggestions(): void {
    setTimeout(() => this.showSuggestions.set(false), 200);
  }

  // ─── Context panel ────────────────────────────────────────────────────────
  toggleContextPanel(): void { this.showContextPanel.update(v => !v); }

  onCountryChange(country: CountryVM | null): void {
    this.chatService.selectedCountry.set(country ?? null);
  }

  onPillarChange(pillar: PillarsVM | null): void {
    this.chatService.selectedPillar.set(pillar ?? null);
  }

  clearContext(): void {
    this.chatService.selectedCountry.set(null);
    this.chatService.selectedPillar.set(null);
  }

  clearHistory(): void { this.chatService.clearHistory(); }

  // ─── Scroll ───────────────────────────────────────────────────────────────
  private scrollToBottom(): void {
    const el = this.messagesContainer?.nativeElement;
    if (el) el.scrollTo({ top: el.scrollHeight, behavior: 'smooth' });
  }

  // ─── Template helpers ─────────────────────────────────────────────────────
  trackById(_: number, msg: ChatMessage): string {
    return msg.id;
  }

  formatTime(date: Date): string {
    return new Date(date).toLocaleTimeString('en-US', {
      hour: '2-digit', minute: '2-digit', hour12: true,
    });
  }

  /** Search both country name and alias (also used as a fallback for pillar name) */
  customSearchFn(term: string, item: any): boolean {
    const t = term.toLowerCase();
    return (
      item.countryName?.toLowerCase().includes(t)  ||
      item.countryAliasName?.toLowerCase().includes(t) ||
      item.pillarName?.toLowerCase().includes(t)   ||
      false
    );
  }
}