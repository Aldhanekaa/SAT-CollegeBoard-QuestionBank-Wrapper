"use client";

import React, {
  useRef,
  useEffect,
  useCallback,
  useReducer,
  useMemo,
  useState,
} from "react";
import OnboardCard from "@/components/ui/onboard-card";
import {
  API_Response_Question,
  API_Response_Question_List,
  PlainQuestionType,
  QuestionState,
  QuestionById_Data,
} from "@/types/question";
import {
  PracticeSelections,
  PracticeSession,
  QuestionAnswers,
  QuestionTimes,
  SessionStatus,
  AnsweredQuestionDetails,
} from "@/types/session";
import { AssessmentType, PracticeStatistics } from "@/types/statistics";
import {
  addQuestionStatistic,
  addAnsweredQuestion,
  updateSessionXP,
} from "@/lib/practiceStatistics";
import { SavedQuestions, SavedQuestion } from "@/types/savedQuestions";
import { QuestionNotes, QuestionNote } from "@/types/questionNotes";
import {
  addXPForCorrectAnswer,
  reduceXPForIncorrectAnswer,
} from "@/lib/userProfile";
import { toast } from "sonner";
import { getSubjectByPrimaryClassCd } from "@/static-data/domains";

import { MathJax, MathJaxContext } from "better-react-mathjax";
import { Pill, PillIndicator } from "@/components/ui/pill";
import { RadioGroup } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  ArrowLeftIcon,
  ArrowRightIcon,
  BookmarkIcon,
  CheckCircle,
  ChevronDown,
  ChevronUp,
  Clock,
  GripHorizontal,
  LinkIcon,
  NotebookPen,
  PyramidIcon,
  SendIcon,
  Strikethrough,
  X,
} from "lucide-react";
import Image from "next/image";

import ReferenceSheet from "@/src/sat-math-refrence-sheet.webp";
import { Confetti, ConfettiRef } from "./ui/confetti";
import { DraggableReferencePopup } from "./popups/reference-popup";
import { DraggableNotesPopup } from "./popups/notes-popup";
import { SaveButton } from "./ui/save-button";
import { playSound } from "@/lib/playSound";
import { useLocalStorage } from "@/lib/useLocalStorage";
import { useRouter } from "next/navigation";
import { LookupRequest } from "@/types";

// Duolingo-styled Loading Spinner Component
interface DuolingoLoadingSpinnerProps {
  progress?: number;
  total?: number;
}

function DuolingoLoadingSpinner({
  progress,
  total,
}: DuolingoLoadingSpinnerProps) {
  const showProgress = progress !== undefined && total !== undefined;

  return (
    <div className="flex items-center justify-center gap-3">
      <div className="flex space-x-1">
        <div className="w-2 h-2 bg-white rounded-full animate-bounce [animation-delay:-0.3s] [animation-duration:0.6s]"></div>
        <div className="w-2 h-2 bg-white rounded-full animate-bounce [animation-delay:-0.15s] [animation-duration:0.6s]"></div>
        <div className="w-2 h-2 bg-white rounded-full animate-bounce [animation-duration:0.6s]"></div>
      </div>
      <span className="text-white font-bold text-lg">
        {showProgress
          ? `Loading batch... (${progress}/${total})`
          : "Loading next batch..."}
      </span>
    </div>
  );
}

// Congratulatory messages array (outside component to avoid dependency issues)
const CONGRATULATORY_MESSAGES = [
  "Nicely done!",
  "Excellent work!",
  "Outstanding!",
  "Great job!",
  "Well done!",
  "Fantastic!",
  "Awesome!",
  "Perfect!",
  "Brilliant!",
  "Amazing work!",
  "You nailed it!",
  "Superb!",
  "Impressive!",
  "You're on fire!",
  "Keep it up!",
];

// Duolingo-styled Timer Component
interface DuolingoTimerProps {
  startTime: number;
  isActive: boolean;
  isVisible: boolean;
  onToggleVisibility: () => void;
  fixedTime?: number; // For showing completed question times in review mode
  savedElapsedTime?: number; // For continuing in-progress questions
}

function DuolingoTimer({
  startTime,
  isActive,
  isVisible,
  onToggleVisibility,
  fixedTime,
  savedElapsedTime = 0,
}: DuolingoTimerProps) {
  const [elapsedTime, setElapsedTime] = React.useState(0);

  React.useEffect(() => {
    let interval: NodeJS.Timeout;

    if (isActive) {
      interval = setInterval(() => {
        setElapsedTime(Date.now() - startTime + savedElapsedTime);
      }, 100); // Update every 100ms for smooth animation
    }

    return () => {
      if (interval) clearInterval(interval);
    };
  }, [isActive, startTime, savedElapsedTime]);

  // Use fixedTime if provided (for review mode), otherwise use elapsedTime
  const displayTime = fixedTime !== undefined ? fixedTime : elapsedTime;

  const formatTime = (ms: number) => {
    const totalSeconds = Math.floor(ms / 1000);
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = totalSeconds % 60;
    return `${minutes}:${seconds.toString().padStart(2, "0")}`;
  };

  const getTimerColor = (ms: number) => {
    const totalSeconds = Math.floor(ms / 1000);
    if (totalSeconds < 30) return "text-green-600";
    if (totalSeconds < 60) return "text-yellow-600";
    if (totalSeconds < 120) return "text-orange-600";
    return "text-red-600";
  };

  return (
    <div className="flex flex-row items-center py-3 gap-2">
      <div
        className={`${
          isVisible ? "block" : "hidden"
        } flex items-center gap-2 bg-white border-2 border-gray-300 rounded-2xl px-4 py-2 shadow-sm`}
      >
        <Clock className={`h-5 w-5 ${getTimerColor(displayTime)}`} />
        <span className={`font-bold text-lg ${getTimerColor(displayTime)}`}>
          {formatTime(displayTime)}
        </span>
        {fixedTime !== undefined && (
          <span className="text-xs text-gray-500 ml-1">(completed)</span>
        )}
      </div>
      <button
        onClick={onToggleVisibility}
        className=" h-12 text-xs text-gray-500 hover:text-gray-700 underline cursor-pointer transition-colors duration-200"
      >
        {isVisible ? "Hide Timer" : "Show Timer"}
      </button>
    </div>
  );
}

// Success Feedback Component
interface SuccessFeedbackProps {
  isVisible: boolean;
  onContinue: () => void;
}

function SuccessFeedback({ isVisible, onContinue }: SuccessFeedbackProps) {
  const [dontShowAgain, setDontShowAgain] = React.useState(false);
  const [hideSuccessFeedback, setHideSuccessFeedback] = React.useState(false);

  // Load localStorage preference on component mount
  React.useEffect(() => {
    try {
      const savedPreference = localStorage.getItem("hideSuccessFeedback");
      setHideSuccessFeedback(savedPreference === "true");
    } catch (error) {
      console.error("Failed to load preference:", error);
    }
  }, []);

  // Auto-continue if user has opted out
  // React.useEffect(() => {
  //   if (isVisible && hideSuccessFeedback) {
  //     const timeoutId = setTimeout(() => onContinue(), 1000);
  //     return () => clearTimeout(timeoutId);
  //   }
  // }, [isVisible, hideSuccessFeedback, onContinue]);

  const randomMessage = useMemo(() => {
    return CONGRATULATORY_MESSAGES[
      Math.floor(Math.random() * CONGRATULATORY_MESSAGES.length)
    ];
  }, []);

  const handleContinue = () => {
    if (dontShowAgain) {
      try {
        localStorage.setItem("hideSuccessFeedback", "true");
        setHideSuccessFeedback(true);
      } catch (error) {
        console.error("Failed to save preference:", error);
      }
    }
    onContinue();
  };

  if (!isVisible || hideSuccessFeedback) return null;

  return (
    <div className="fixed inset-0 flex items-center justify-center z-50 bg-black/20">
      <div className="bg-green-100 border-4 border-green-200 rounded-3xl p-8 max-w-md w-full mx-4 shadow-2xl">
        <div className="text-center">
          <div className="flex items-center justify-center gap-3 mb-6">
            <CheckCircle className="h-8 w-8 text-green-600" />
            <h2 className="text-3xl font-bold text-green-800">
              {randomMessage}
            </h2>
          </div>

          {/* Checkbox for "Don't show again" */}
          <div className="flex items-center justify-center gap-3 mb-4">
            <Checkbox
              id="dontShowAgain"
              checked={dontShowAgain}
              onCheckedChange={(checked: boolean) => {
                const isChecked = checked === true;
                setDontShowAgain(isChecked);
                // Play appropriate checkbox sound
                if (isChecked) {
                  playSound("tap-checkbox-checked.wav");
                } else {
                  playSound("tap-checkbox-unchecked.wav");
                }
              }}
              className="border-green-300 data-[state=checked]:bg-green-600 data-[state=checked]:border-green-600"
            />
            <label
              htmlFor="dontShowAgain"
              className="text-sm text-green-700 cursor-pointer select-none"
            >
              Don&apos;t show this again
            </label>
          </div>

          <button
            onClick={handleContinue}
            className="cursor-pointer w-full bg-green-600 hover:bg-green-700 text-white font-bold text-xl py-4 px-8 rounded-2xl border-b-4 border-green-800 hover:border-green-900 shadow-lg hover:shadow-xl transform transition-all duration-200 active:translate-y-0.5 active:border-b-2"
          >
            CONTINUE
          </button>
        </div>
      </div>
    </div>
  );
}

// Exit Confirmation Component
interface ExitConfirmationProps {
  isVisible: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}

function ExitConfirmation({
  isVisible,
  onConfirm,
  onCancel,
}: ExitConfirmationProps) {
  // Play sound when popup opens
  React.useEffect(() => {
    if (isVisible) {
      playSound("popup-confirm-up.wav");
    }
  }, [isVisible]);

  // Enhanced handlers that play sound on close
  const handleCancel = () => {
    playSound("popup-confirm-down.wav");
    onCancel();
  };

  const handleConfirm = () => {
    playSound("popup-confirm-down.wav");
    onConfirm();
  };

  if (!isVisible) return null;

  return (
    <div className="fixed inset-0 flex items-center justify-center z-50 bg-black/20">
      <div className="bg-red-50 border-4 border-red-200 rounded-3xl p-8 max-w-md w-full mx-4 shadow-2xl">
        <div className="text-center">
          <div className="flex items-center justify-center gap-3 mb-6">
            <X className="h-8 w-8 text-red-600" />
            <h2 className="text-3xl font-bold text-red-800">Exit Practice?</h2>
          </div>
          <p className="text-lg text-red-700 mb-8">
            Your progress will be saved, but you&apos;ll lose your current
            streak. Are you sure you want to exit?
          </p>
          <div className="flex gap-4">
            <button
              onClick={handleCancel}
              className="cursor-pointer flex-1 bg-blue-500 hover:bg-blue-600 text-white font-bold text-lg py-4 px-6 rounded-2xl border-b-4 border-blue-600 hover:border-blue-700 shadow-lg hover:shadow-xl transform transition-all duration-200 active:translate-y-0.5 active:border-b-2"
            >
              STAY
            </button>
            <button
              onClick={handleConfirm}
              className="cursor-pointer flex-1 bg-red-600 hover:bg-red-700 text-white font-bold text-lg py-4 px-6 rounded-2xl border-b-4 border-red-800 hover:border-red-900 shadow-lg hover:shadow-xl transform transition-all duration-200 active:translate-y-0.5 active:border-b-2"
            >
              EXIT
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// Finish Confirmation Component
interface FinishConfirmationProps {
  isVisible: boolean;
  onConfirm: () => void;
  onCancel: () => void;
  questionsAnswered: number;
}

function FinishConfirmation({
  isVisible,
  onConfirm,
  onCancel,
  questionsAnswered,
}: FinishConfirmationProps) {
  // Play sound when popup opens
  React.useEffect(() => {
    if (isVisible) {
      playSound("popup-confirm-up.wav");
    }
  }, [isVisible]);

  // Enhanced handlers that play sound on close
  const handleCancel = () => {
    playSound("popup-confirm-down.wav");
    onCancel();
  };

  const handleConfirm = () => {
    playSound("popup-confirm-down.wav");
    onConfirm();
  };

  if (!isVisible) return null;

  return (
    <div className="fixed inset-0 flex items-center justify-center z-50 bg-black/20">
      <div className="bg-green-50 border-4 border-green-200 rounded-3xl p-8 max-w-md w-full mx-4 shadow-2xl">
        <div className="text-center">
          <div className="flex items-center justify-center gap-3 mb-6">
            <CheckCircle className="h-8 w-8 text-green-600" />
            <h2 className="text-3xl font-bold text-green-800">
              Finish Practice?
            </h2>
          </div>
          <p className="text-lg text-green-700 mb-4">
            You&apos;ve answered {questionsAnswered} questions so far.
          </p>
          <p className="text-lg text-green-700 mb-8">
            Are you ready to finish this practice session and see your results?
          </p>
          <div className="flex gap-4">
            <button
              onClick={handleCancel}
              className="cursor-pointer flex-1 bg-blue-500 hover:bg-blue-600 text-white font-bold text-lg py-4 px-6 rounded-2xl border-b-4 border-blue-600 hover:border-blue-700 shadow-lg hover:shadow-xl transform transition-all duration-200 active:translate-y-0.5 active:border-b-2"
            >
              CONTINUE
            </button>
            <button
              onClick={handleConfirm}
              className="cursor-pointer flex-1 bg-green-600 hover:bg-green-700 text-white font-bold text-lg py-4 px-6 rounded-2xl border-b-4 border-green-800 hover:border-green-900 shadow-lg hover:shadow-xl transform transition-all duration-200 active:translate-y-0.5 active:border-b-2"
            >
              FINISH
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// Share Modal Component
interface ShareModalProps {
  isVisible: boolean;
  onClose: () => void;
  practiceSelections: PracticeSelections;
  questions: QuestionState[] | null;
}

function ShareModal({
  isVisible,
  onClose,
  practiceSelections,
  questions,
}: ShareModalProps) {
  const [shareUrl, setShareUrl] = React.useState("");
  const [isCopied, setIsCopied] = React.useState(false);

  // Generate share URL
  React.useEffect(() => {
    if (!isVisible || !questions) return;

    const questionIds = questions
      .map((q) => q.plainQuestion.questionId)
      .join(",");
    const domainIds = practiceSelections.domains
      .map((d) => d.primaryClassCd)
      .join(",");
    const skillCds = practiceSelections.skills.map((s) => s.skill_cd).join(",");

    const params = new URLSearchParams({
      type: practiceSelections.practiceType,
      assessment: practiceSelections.assessment,
      subject: practiceSelections.subject,
      domains: domainIds,
      skillCds: skillCds,
      questionIds: questionIds,
      randomize: practiceSelections.randomize.toString(),
    });

    const url = `${window.location.origin}/practice?${params.toString()}`;
    setShareUrl(url);
  }, [isVisible, practiceSelections, questions]);

  // Play sound when popup opens
  React.useEffect(() => {
    if (isVisible) {
      playSound("popup-confirm-up.wav");
    }
  }, [isVisible]);

  const handleClose = () => {
    playSound("popup-confirm-down.wav");
    onClose();
    setIsCopied(false);
  };

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(shareUrl);
      setIsCopied(true);
      playSound("button-pressed.wav");
      setTimeout(() => setIsCopied(false), 3000);
    } catch (error) {
      console.error("Failed to copy to clipboard:", error);
      toast.error("Failed to Copy Link", {
        description:
          "Couldn't copy the link to your clipboard. Please try again or copy manually.",
        duration: 4000,
      });
    }
  };

  if (!isVisible) return null;

  return (
    <div className="fixed inset-0 flex items-center justify-center z-50 bg-black/20">
      <div className="bg-blue-50 border-4 border-blue-200 rounded-3xl p-8 max-w-lg w-full mx-4 shadow-2xl">
        <div className="text-center">
          <div className="flex items-center justify-center gap-3 mb-6">
            <SendIcon className="h-8 w-8 text-blue-600" />
            <h2 className="text-3xl font-bold text-blue-800">
              Share Practice Session
            </h2>
          </div>
          <p className="text-lg text-blue-700 mb-6">
            Share this practice session with others! They&apos;ll get the same
            questions and settings.
          </p>

          {/* URL Input with copy button */}
          <div className="relative mb-6">
            <div className="flex gap-2">
              <input
                type="text"
                value={shareUrl}
                readOnly
                className="flex-1 px-4 py-3 text-sm bg-white border-2 border-blue-300 rounded-2xl font-mono text-blue-800 focus:outline-none focus:border-blue-500 transition-all duration-200"
                placeholder="Generating share link..."
              />
              <Button
                onClick={handleCopy}
                className={`px-6 py-3 font-bold text-sm rounded-2xl border-2 border-b-4 shadow-lg transform transition-all duration-200 active:translate-y-0.5 active:border-b-2 ${
                  isCopied
                    ? "bg-green-500 hover:bg-green-600 text-white border-green-700 hover:border-green-800"
                    : "bg-blue-500 hover:bg-blue-600 text-white border-blue-700 hover:border-blue-800"
                }`}
              >
                {isCopied ? "Copied!" : "Copy"}
              </Button>
            </div>
          </div>

          {/* Success message */}
          {isCopied && (
            <div className="mb-6 p-3 bg-green-100 border-2 border-green-300 rounded-2xl">
              <p className="text-green-800 font-semibold">
                ✓ Link copied to clipboard!
              </p>
            </div>
          )}

          {/* Practice details */}
          <div className="mb-6 p-4 bg-white border-2 border-blue-200 rounded-2xl text-left">
            <h3 className="font-bold text-blue-800 mb-2">Session Details:</h3>
            <div className="space-y-1 text-sm text-blue-700">
              <p>
                <span className="font-semibold">Assessment:</span>{" "}
                {practiceSelections.assessment}
              </p>
              <p>
                <span className="font-semibold">Subject:</span>{" "}
                {practiceSelections.subject}
              </p>
              <p>
                <span className="font-semibold">Domains:</span>{" "}
                {practiceSelections.domains.length}
              </p>
              <p>
                <span className="font-semibold">Skills:</span>{" "}
                {practiceSelections.skills.length}
              </p>
              <p>
                <span className="font-semibold">Questions:</span>{" "}
                {questions?.length || 0}
              </p>
            </div>
          </div>

          <Button
            onClick={handleClose}
            className="cursor-pointer w-full bg-blue-500 hover:bg-blue-600 text-white font-bold text-lg py-4 px-6 rounded-2xl border-b-4 border-blue-600 hover:border-blue-700 shadow-lg hover:shadow-xl transform transition-all duration-200 active:translate-y-0.5 active:border-b-2"
          >
            Close
          </Button>
        </div>
      </div>
    </div>
  );
}

// Duolingo-styled Input Component
interface DuolingoInputProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  disabled?: boolean;
  onSubmit?: () => void;
}

// Optimized Duolingo-styled Input Component
const DuolingoInput = React.memo(function DuolingoInput({
  value,
  onChange,
  placeholder = "Type your answer here...",
  disabled = false,
  onSubmit,
}: DuolingoInputProps) {
  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter" && !disabled && onSubmit && value?.trim()) {
      e.preventDefault();
      onSubmit();
    }
  };

  return (
    <div className="w-full">
      <div className="relative">
        <input
          type="text"
          value={value || ""}
          onChange={(e) => !disabled && onChange(e.target.value)}
          onKeyDown={handleKeyDown}
          onFocus={() => !disabled && playSound("button-pressed.wav")}
          placeholder={placeholder}
          disabled={disabled}
          className={`w-full px-4 py-4 text-lg font-medium border-2 border-b-4 rounded-2xl focus:outline-none transition-all duration-200 shadow-sm ${
            disabled
              ? "border-gray-300 bg-gray-100 text-gray-500 cursor-not-allowed"
              : "border-gray-300 focus:border-blue-500 focus:border-b-blue-500 focus:ring-0 bg-white hover:shadow-md focus:shadow-lg"
          }`}
        />
      </div>
    </div>
  );
});

// Answer Options Component
interface AnswerOptionsProps {
  answerOptions: { [key: string]: string };
  questionId: string;
  selectedAnswer: string | null;
  disabledOptions: { [key: string]: boolean };
  onAnswerSelect: (key: string) => void;
  onToggleDisabled: (key: string) => void;
  showStrikethrough: boolean;
  correctAnswers?: string[];
  isAnswerChecked?: boolean;
  isReviewMode?: boolean;
  duplicateSession?: boolean;
}

// Optimized Answer Options Component
const AnswerOptions = React.memo(function AnswerOptions({
  answerOptions,
  questionId,
  selectedAnswer,
  disabledOptions,
  onAnswerSelect,
  onToggleDisabled,
  showStrikethrough,
  correctAnswers = [],
  isAnswerChecked = false,
  isReviewMode = false,
  duplicateSession,
}: AnswerOptionsProps) {
  const optionEntries = useMemo(
    () => Object.entries(answerOptions),
    [answerOptions]
  );

  // Note: isReviewMode indicates when displaying a previously answered question
  // This can be used for additional review-specific logic if needed
  React.useEffect(() => {
    if (isReviewMode) {
      // Additional review-specific setup can be added here
    }
  }, [isReviewMode]);

  return (
    <RadioGroup className="flex flex-col gap-3" defaultValue="1">
      {optionEntries.map(([key, value], index) => {
        const trimmedKey = key.trim();
        const isCorrectAnswer =
          isAnswerChecked && correctAnswers.includes(trimmedKey);
        const isSelectedWrongAnswer =
          isAnswerChecked &&
          selectedAnswer?.trim() === trimmedKey &&
          !correctAnswers.includes(trimmedKey);
        const isSelected = selectedAnswer?.trim() === trimmedKey;

        return (
          <div
            key={`${key}-${questionId}`}
            className="flex z-20 items-center gap-2 answer-option"
          >
            <label
              onClick={() => {
                if (
                  selectedAnswer?.trim() !== trimmedKey &&
                  !disabledOptions[key] &&
                  !isAnswerChecked &&
                  !isReviewMode
                ) {
                  playSound("button-pressed.wav");
                  onAnswerSelect(key);
                }
              }}
              className={`relative ${
                disabledOptions[key]
                  ? " cursor-not-allowed after:absolute after:inset-0 after:h-0.5 after:w-[102.5%] after:bg-black after:-translate-x-1/2 after:left-1/2 after:top-1/2 after:-translate-y-1/2"
                  : isAnswerChecked || isReviewMode
                  ? "cursor-default"
                  : "cursor-pointer"
              } w-full transition duration-500 ${
                isAnswerChecked &&
                (isCorrectAnswer || correctAnswers.includes(key))
                  ? "border-2 border-green-500 bg-green-500/10"
                  : isSelectedWrongAnswer
                  ? "border-2 border-red-500 bg-red-500/10"
                  : isSelected
                  ? "border-2 border-blue-500 bg-blue-500/10"
                  : "border-2 border-input"
              } has-[[data-disabled]]:opacity-50  has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-ring/70 flex flex-col items-start gap-4 rounded-lg p-3 shadow-sm shadow-black/5`}
            >
              <div className={`grid grid-cols-9 items-center gap-3 `}>
                <div className="col-span-1 flex items-center justify-center">
                  <div
                    className={`w-8 h-8 rounded-full border-2 flex items-center justify-center text-sm font-semibold ${
                      isAnswerChecked && isCorrectAnswer
                        ? "border-green-500 bg-green-500 text-white"
                        : isSelectedWrongAnswer
                        ? "border-red-500 bg-red-500 text-white"
                        : isSelected
                        ? "border-blue-500 bg-blue-500 text-white"
                        : "border-gray-300 bg-gray-50 text-gray-600"
                    }`}
                  >
                    {isCorrectAnswer ? (
                      <CheckCircle className="h-4 w-4" />
                    ) : isSelectedWrongAnswer ? (
                      <X className="h-4 w-4" />
                    ) : (
                      String.fromCharCode(65 + index)
                    )}
                  </div>
                </div>
                <Label className="col-span-8" htmlFor={`${key}-${questionId}`}>
                  <MathJax
                    className={`inline-block ${
                      !isReviewMode && "cursor-pointer"
                    }`}
                    inline
                    dynamic
                  >
                    <span
                      className="text-xl inline-block"
                      dangerouslySetInnerHTML={{
                        __html: value,
                      }}
                    ></span>
                  </MathJax>
                </Label>
              </div>
            </label>
            {showStrikethrough && (
              <Button
                variant={"ghost"}
                className="h-full w-14 cursor-pointer"
                onClick={() => {
                  if (selectedAnswer?.trim() !== trimmedKey) {
                    playSound("button-pressed.wav");
                    onToggleDisabled(key);
                  }
                }}
              >
                {disabledOptions[key] ? (
                  <p className=" underline">Undo</p>
                ) : (
                  <Strikethrough className="h-6 w-6" />
                )}
              </Button>
            )}
          </div>
        );
      })}
    </RadioGroup>
  );
});

// State management with useReducer for better performance
interface AppState {
  questionsData: API_Response_Question_List | null;
  questions: QuestionState[] | null;
  currentQuestionStep: number;
  questionAnswers: QuestionAnswers;
  questionTimes: QuestionTimes;
  answeredQuestionDetails: AnsweredQuestionDetails; // New field for question metadata
  inProgressQuestionTimes: { [questionId: string]: number }; // Track elapsed time for questions in progress
  disabledOptions: { [key: string]: boolean };
  selectedAnswer: string | null;
  isReferencePopupOpen: boolean;
  isAnswerChecked: boolean;
  isAnswerCorrect: boolean;
  currentStep: number;
  isExitConfirmationOpen: boolean;
  isFinishConfirmationOpen: boolean;
  questionStartTime: number;
  currentQuestionElapsedTime: number; // Track elapsed time for current question
  isTimerActive: boolean;
  isTimerVisible: boolean;
  isLoadingNextBatch: boolean;
  currentBatch: number; // Keep for backward compatibility but will be deprecated
  questionsLoadedCount: number; // Track total questions loaded so far
  questionsProcessedCount: number;
  totalQuestionsToFetch: number; // Track total number of questions that need to be fetched
  cachedSelectionsHash: string | null; // Hash of practice selections to validate cache compatibility
  sessionId: string;
  sessionStartTime: number;
  isSavingSession: boolean;
  isShareModalOpen: boolean;
  isNotesPopupOpen: boolean;
  sessionXPReceived: number; // Track total XP gained/lost during this session

  lookupData: LookupRequest | undefined;
}

type AppAction =
  | {
      type: "SET_QUESTIONS_DATA";
      payload: API_Response_Question_List;
      selectionsHash?: string;
    }
  | { type: "SET_QUESTIONS"; payload: QuestionState[] }
  | { type: "SET_CURRENT_STEP"; payload: number }
  | { type: "SET_CURRENT_QUESTION_STEP"; payload: number }
  | { type: "SET_SELECTED_ANSWER"; payload: string | null }
  | { type: "SET_DISABLED_OPTION"; payload: { key: string; value: boolean } }
  | { type: "RESET_QUESTION_STATE" }
  | { type: "SAVE_CURRENT_ELAPSED_TIME"; payload: number }
  | {
      type: "SET_ANSWER_CHECKED";
      payload: {
        checked: boolean;
        correct: boolean;
        questionId: string;
        answer: string;
        timeElapsed: number;
        externalId: string | null;
        ibn: string | null;
        plainQuestion?: PlainQuestionType; // Add plainQuestion to payload
      };
    }
  | { type: "TOGGLE_REFERENCE_POPUP" }
  | { type: "TOGGLE_EXIT_CONFIRMATION" }
  | { type: "TOGGLE_FINISH_CONFIRMATION" }
  | { type: "TOGGLE_SHARE_MODAL" }
  | { type: "TOGGLE_NOTES_POPUP" }
  | { type: "START_TIMER" }
  | { type: "STOP_TIMER" }
  | { type: "TOGGLE_TIMER_VISIBILITY" }
  | { type: "START_LOADING_NEXT_BATCH" }
  | { type: "FINISH_LOADING_NEXT_BATCH"; payload: QuestionState[] }
  | { type: "SET_QUESTIONS_PROCESSED_COUNT"; payload: number }
  | { type: "SET_TOTAL_QUESTIONS_TO_FETCH"; payload: number }
  | {
      type: "INITIALIZE_SESSION";
      payload: {
        practiceSelections: PracticeSelections;
        totalQuestions: number;
        restoredSessionData?: PracticeSession;
      };
    }
  | {
      type: "RESTORE_SESSION_STATE";
      payload: {
        currentQuestionStep: number;
        questionAnswers: QuestionAnswers;
        questionTimes: QuestionTimes;
        answeredQuestionDetails: AnsweredQuestionDetails;
        sessionId: string;
        sessionStartTime: number;
      };
    }
  | { type: "SET_SAVING_SESSION"; payload: boolean }
  | { type: "ADD_SESSION_XP"; payload: number }
  | { type: "SET_LOOKUP_DATA"; payload: LookupRequest };
const initialState: AppState = {
  questionsData: null,
  questions: null,
  currentQuestionStep: 0,
  questionAnswers: {},
  questionTimes: {},
  answeredQuestionDetails: [], // Initialize empty array
  inProgressQuestionTimes: {},
  disabledOptions: {},
  selectedAnswer: null,
  isReferencePopupOpen: false,
  isAnswerChecked: false,
  isAnswerCorrect: false,
  currentStep: 1,
  isExitConfirmationOpen: false,
  isFinishConfirmationOpen: false,
  questionStartTime: Date.now(),
  currentQuestionElapsedTime: 0,
  isTimerActive: false,
  isTimerVisible: true,
  isLoadingNextBatch: false,
  currentBatch: 1,
  questionsLoadedCount: 22, // Initially load 22 questions
  questionsProcessedCount: 0,
  totalQuestionsToFetch: 0, // Initialize total questions to fetch
  cachedSelectionsHash: null, // No cached selections initially
  sessionId: `practice-${Date.now()}-${Math.random()
    .toString(36)
    .substr(2, 9)}`,
  sessionStartTime: Date.now(),
  isSavingSession: false,
  isShareModalOpen: false,
  isNotesPopupOpen: false,
  sessionXPReceived: 0, // Initialize session XP tracking

  lookupData: undefined,
};

function appReducer(state: AppState, action: AppAction): AppState {
  switch (action.type) {
    case "SET_QUESTIONS_DATA":
      return {
        ...state,
        questionsData: action.payload,
        cachedSelectionsHash:
          action.selectionsHash || state.cachedSelectionsHash,
      };
    case "SET_QUESTIONS":
      return {
        ...state,
        questions: action.payload,
        questionsLoadedCount: action.payload.length, // Set loaded count to initial questions length
        questionsProcessedCount: 0, // Reset progress counter after questions are loaded
        totalQuestionsToFetch: 0, // Reset total questions counter
      };
    case "SET_CURRENT_STEP":
      return { ...state, currentStep: action.payload };
    case "SET_CURRENT_QUESTION_STEP":
      const newStep = action.payload;
      const newQuestionId =
        state.questions?.[newStep]?.plainQuestion.questionId || "";
      const currentQuestionId =
        state.questions?.[state.currentQuestionStep]?.plainQuestion
          .questionId || "";
      const previousAnswer = state.questionAnswers[newQuestionId];
      const isReturningToPreviousQuestion = Boolean(previousAnswer);

      // Save current elapsed time if we're navigating away from an active question
      const currentElapsed =
        state.isTimerActive &&
        currentQuestionId &&
        currentQuestionId !== newQuestionId
          ? Date.now() -
            state.questionStartTime +
            state.currentQuestionElapsedTime
          : 0;

      const updatedInProgressTimes =
        currentElapsed > 0
          ? {
              ...state.inProgressQuestionTimes,
              [currentQuestionId]: currentElapsed,
            }
          : state.inProgressQuestionTimes;

      // Check if we're returning to a question in progress
      const isReturningToInProgress =
        !isReturningToPreviousQuestion && updatedInProgressTimes[newQuestionId];
      const savedElapsedTime = updatedInProgressTimes[newQuestionId] || 0;

      return {
        ...state,
        currentQuestionStep: newStep,
        selectedAnswer: isReturningToPreviousQuestion ? previousAnswer : null,
        disabledOptions: {},
        isAnswerChecked: isReturningToPreviousQuestion,
        isAnswerCorrect: isReturningToPreviousQuestion
          ? state.questions?.[newStep]?.correct_answer
              .map((answer) => answer.trim())
              .includes(previousAnswer?.trim() || "") || false
          : false,
        questionStartTime: Date.now(), // Always start from current time
        currentQuestionElapsedTime: isReturningToInProgress
          ? savedElapsedTime
          : 0, // Store saved elapsed time
        isTimerActive: !isReturningToPreviousQuestion,
        inProgressQuestionTimes: updatedInProgressTimes,
      };
    case "SET_SELECTED_ANSWER":
      return { ...state, selectedAnswer: action.payload };
    case "SET_DISABLED_OPTION":
      return {
        ...state,
        disabledOptions: {
          ...state.disabledOptions,
          [action.payload.key]: action.payload.value,
        },
      };
    case "RESET_QUESTION_STATE":
      return {
        ...state,
        selectedAnswer: null,
        disabledOptions: {},
        isAnswerChecked: false,
        isAnswerCorrect: false,
        questionStartTime: Date.now(),
        currentQuestionElapsedTime: 0,
        isTimerActive: true,
      };
    case "SAVE_CURRENT_ELAPSED_TIME":
      return {
        ...state,
        currentQuestionElapsedTime: action.payload,
      };
    case "SET_ANSWER_CHECKED":
      const questionId = action.payload.questionId;
      const updatedInProgress = { ...state.inProgressQuestionTimes };
      delete updatedInProgress[questionId]; // Remove from in-progress tracking

      // Add or update question details if answer is provided
      const updatedQuestionDetails = [...state.answeredQuestionDetails];
      if (action.payload.answer) {
        // Check if question already exists in details
        const existingDetailIndex = updatedQuestionDetails.findIndex(
          (detail) => detail.questionId === questionId
        );

        const questionDetail = {
          questionId,
          externalId: action.payload.externalId,
          ibn: action.payload.ibn,
          plainQuestion: action.payload.plainQuestion, // Include plainQuestion data
        };

        if (existingDetailIndex !== -1) {
          // Update existing detail
          updatedQuestionDetails[existingDetailIndex] = questionDetail;
        } else {
          // Add new detail
          updatedQuestionDetails.push(questionDetail);
        }
      }

      return {
        ...state,
        isAnswerChecked: action.payload.checked,
        isAnswerCorrect: action.payload.correct,
        questionAnswers: {
          ...state.questionAnswers,
          [questionId]: action.payload.answer,
        },
        questionTimes: {
          ...state.questionTimes,
          [questionId]: action.payload.timeElapsed,
        },
        answeredQuestionDetails: updatedQuestionDetails,
        inProgressQuestionTimes: updatedInProgress,
      };
    case "TOGGLE_REFERENCE_POPUP":
      return { ...state, isReferencePopupOpen: !state.isReferencePopupOpen };
    case "TOGGLE_EXIT_CONFIRMATION":
      return {
        ...state,
        isExitConfirmationOpen: !state.isExitConfirmationOpen,
      };

    case "SET_LOOKUP_DATA":
      return {
        ...state,
        lookupData: action.payload,
      };

    case "TOGGLE_FINISH_CONFIRMATION":
      return {
        ...state,
        isFinishConfirmationOpen: !state.isFinishConfirmationOpen,
      };
    case "TOGGLE_SHARE_MODAL":
      return {
        ...state,
        isShareModalOpen: !state.isShareModalOpen,
      };
    case "TOGGLE_NOTES_POPUP":
      return {
        ...state,
        isNotesPopupOpen: !state.isNotesPopupOpen,
      };
    case "START_TIMER":
      return {
        ...state,
        questionStartTime: Date.now(),
        currentQuestionElapsedTime: 0,
        isTimerActive: true,
      };
    case "STOP_TIMER":
      return {
        ...state,
        isTimerActive: false,
      };
    case "TOGGLE_TIMER_VISIBILITY":
      return {
        ...state,
        isTimerVisible: !state.isTimerVisible,
      };
    case "START_LOADING_NEXT_BATCH":
      return {
        ...state,
        isLoadingNextBatch: true,
        questionsProcessedCount: 0, // Reset count when starting new batch
        currentStep: 3, // Show loading screen
      };
    case "FINISH_LOADING_NEXT_BATCH":
      return {
        ...state,
        isLoadingNextBatch: false,
        questions: [...(state.questions || []), ...action.payload], // Append new questions to existing ones
        questionsLoadedCount:
          state.questionsLoadedCount + action.payload.length, // Update loaded count
        currentStep: 5, // Return to practice
        questionsProcessedCount: 0, // Reset count after loading
      };
    case "SET_QUESTIONS_PROCESSED_COUNT":
      return {
        ...state,
        questionsProcessedCount: action.payload,
      };
    case "SET_TOTAL_QUESTIONS_TO_FETCH":
      return {
        ...state,
        totalQuestionsToFetch: action.payload,
      };
    case "INITIALIZE_SESSION":
      // Use restored session ID if available, otherwise create new one
      const sessionId =
        action.payload.restoredSessionData?.sessionId ||
        `practice-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

      return {
        ...state,
        sessionId: sessionId,
        sessionStartTime: Date.now(),
      };
    case "SET_SAVING_SESSION":
      return {
        ...state,
        isSavingSession: action.payload,
      };
    case "RESTORE_SESSION_STATE":
      return {
        ...state,
        currentQuestionStep: action.payload.currentQuestionStep,
        questionAnswers: action.payload.questionAnswers,
        questionTimes: action.payload.questionTimes,
        answeredQuestionDetails: action.payload.answeredQuestionDetails,
        sessionId: action.payload.sessionId,
        sessionStartTime: action.payload.sessionStartTime,
      };
    case "ADD_SESSION_XP":
      return {
        ...state,
        sessionXPReceived: state.sessionXPReceived + action.payload,
      };
    default:
      return state;
  }
}

interface PracticeRushMultistepProps {
  practiceSelections: PracticeSelections;
  onSessionComplete?: (
    sessionData: PracticeSession,
    correctAnswers: { [questionId: string]: Array<string> }
  ) => void;
  restoredSessionData?: PracticeSession; // New prop for passing down localStorage data
  isReviewMode?: boolean; // New prop for review-only mode
}

export default function PracticeRushMultistep({
  practiceSelections,
  onSessionComplete,
  restoredSessionData,
  isReviewMode = false,
}: PracticeRushMultistepProps) {
  const router = useRouter();
  const confettiRef = useRef<ConfettiRef>(null);

  const [state, dispatch] = useReducer(appReducer, initialState);
  const [isGridCollapsed, setIsGridCollapsed] = useState(false);

  // Load question notes from localStorage
  const [questionNotes, setQuestionNotes] = useLocalStorage<QuestionNotes>(
    "questionNotes",
    {}
  );

  // Load saved questions from localStorage
  const [savedQuestions, setSavedQuestions] = useLocalStorage<SavedQuestions>(
    "savedQuestions",
    {}
  );

  // Check URL parameters to determine if this is a continue session
  const isContinueSession = useMemo(() => {
    if (typeof window !== "undefined") {
      const urlParams = new URLSearchParams(window.location.search);
      return urlParams.get("session") === "continue";
    }
    return false;
  }, []);

  // Track saving status with ref to avoid re-renders
  const isSavingRef = useRef(false);

  // Auto-save session data to localStorage
  const saveCurrentSession = useCallback(() => {
    // Don't save if session is already completed (in full review mode)
    if (
      restoredSessionData &&
      (restoredSessionData.status as string) === "completed"
    ) {
      return;
    }

    if (!state.questions || state.questions.length === 0 || isSavingRef.current)
      return;

    isSavingRef.current = true;
    dispatch({ type: "SET_SAVING_SESSION", payload: true });

    // Calculate correct answers by comparing user answers with correct answers
    const answeredQuestions = Object.keys(state.questionAnswers).filter(
      (id) => state.questionAnswers[id] !== null
    );

    let correctAnswersCount = 0;
    answeredQuestions.forEach((questionId) => {
      const userAnswer = state.questionAnswers[questionId];

      const question = state.questions?.find(
        (q) => q.plainQuestion.questionId === questionId
      );

      // console.log("User Answer:", userAnswer);
      // console.log("Question ID:", questionId);
      // console.log("Question Data:", question);

      if (question && userAnswer && question.correct_answer) {
        // Handle both single correct answer and multiple correct answers
        const correctAnswers = Array.isArray(question.correct_answer)
          ? question.correct_answer
          : [question.correct_answer];

        if (correctAnswers.map((e) => e.trim()).includes(userAnswer)) {
          correctAnswersCount++;
        }
      }
    });

    // Determine session status - only set to COMPLETED if explicitly completing
    // For continue sessions or reviewing incomplete sessions, keep as IN_PROGRESS
    const currentSessionStatus =
      restoredSessionData &&
      (restoredSessionData.status as string) === "completed"
        ? SessionStatus.COMPLETED
        : SessionStatus.IN_PROGRESS;

    // Use restored session ID when continuing/reviewing, otherwise use current session ID
    const sessionIdToUse =
      (isContinueSession || isReviewMode) && restoredSessionData?.sessionId
        ? restoredSessionData.sessionId
        : state.sessionId;

    const currentSession: PracticeSession & {
      correctAnswers?: number;
      accuracyPercentage?: number;
    } = {
      sessionId: sessionIdToUse,
      timestamp: new Date(state.sessionStartTime).toISOString(),
      status: currentSessionStatus,
      practiceSelections,
      currentQuestionStep: state.currentQuestionStep,
      questionAnswers: state.questionAnswers,
      questionTimes: state.questionTimes,
      answeredQuestionDetails: state.answeredQuestionDetails,
      totalQuestions: state.questions.length,
      answeredQuestions,
      correctAnswers: correctAnswersCount,
      accuracyPercentage:
        answeredQuestions.length > 0
          ? Math.round((correctAnswersCount / answeredQuestions.length) * 100)
          : 0,
      averageTimePerQuestion:
        Object.keys(state.questionTimes).length > 0
          ? Object.values(state.questionTimes).reduce(
              (sum, time) => sum + time,
              0
            ) / Object.keys(state.questionTimes).length
          : 0,
      totalTimeSpent: Object.values(state.questionTimes).reduce(
        (sum, time) => sum + time,
        0
      ),
      totalXPReceived: state.sessionXPReceived, // Include session XP tracking
    };

    try {
      // Save current session
      localStorage.setItem(
        "currentPracticeSession",
        JSON.stringify(currentSession)
      );

      // Update practice sessions history
      const existingSessions = localStorage.getItem("practiceHistory");
      const sessions: PracticeSession[] = existingSessions
        ? JSON.parse(existingSessions)
        : [];

      // Find if this session already exists in history
      const existingIndex = sessions.findIndex(
        (session) => session.sessionId === state.sessionId
      );

      if (existingIndex !== -1) {
        // Update existing session
        sessions[existingIndex] = currentSession;
      } else {
        // Add new session
        sessions.push(currentSession);
      }

      // Keep only last 20 sessions
      const recentSessions = sessions.slice(-20);
      localStorage.setItem("practiceHistory", JSON.stringify(recentSessions));

      // Show saving indicator briefly
      setTimeout(() => {
        isSavingRef.current = false;
        dispatch({ type: "SET_SAVING_SESSION", payload: false });
      }, 500);
    } catch (error) {
      console.error("Failed to save session:", error);
      toast.error("Failed to Save Session", {
        description:
          "Your progress couldn't be saved. Please check your connection and try again.",
        duration: 5000,
      });
      isSavingRef.current = false;
      dispatch({ type: "SET_SAVING_SESSION", payload: false });
    }
  }, [
    state.questions,
    state.sessionId,
    state.sessionStartTime,
    state.currentQuestionStep,
    state.questionAnswers,
    state.questionTimes,
    state.answeredQuestionDetails,
    state.sessionXPReceived,
    practiceSelections,
    restoredSessionData,
    isContinueSession,
    isReviewMode,
  ]);

  const currentQuestion = useMemo(
    () => (state.questions ? state.questions[state.currentQuestionStep] : null),
    [state.questions, state.currentQuestionStep]
  );

  // Convert QuestionState to QuestionById_Data format for SaveButton compatibility
  const currentQuestionForSave = useMemo(() => {
    if (!currentQuestion) return null;

    const questionById: QuestionById_Data = {
      question: currentQuestion.plainQuestion,
      problem: {
        answerOptions: currentQuestion.answerOptions || undefined,
        correct_answer: currentQuestion.correct_answer,
        rationale: currentQuestion.rationale,
        stem: currentQuestion.stem,
        stimulus: currentQuestion.stimulus,
        type: currentQuestion.type || "mcq", // Default to multiple choice if not specified
      },
    };

    return questionById;
  }, [currentQuestion]);

  // Check if current question is saved
  const isCurrentQuestionSaved = useMemo(() => {
    if (!currentQuestion || !savedQuestions[practiceSelections.assessment]) {
      return false;
    }

    return savedQuestions[practiceSelections.assessment].some(
      (q) => q.questionId === currentQuestion.plainQuestion.questionId
    );
  }, [currentQuestion, savedQuestions, practiceSelections.assessment]);

  // Determine if we're effectively in review mode (either explicitly or session is completed)
  const effectiveReviewMode = useMemo(
    () =>
      isReviewMode ||
      (restoredSessionData &&
        (restoredSessionData.status as string) === "completed"),
    [isReviewMode, restoredSessionData]
  );

  // console.log("Effective Review Mode:", effectiveReviewMode);
  // console.log("Current restoredSessionData:", restoredSessionData);

  // Use a ref to track the last processed question in review mode to prevent infinite loops
  const lastProcessedQuestionRef = useRef<string | null>(null);

  // Set selected answer and checked state when in review mode OR when continuing a session with previous answers
  useEffect(() => {
    if (currentQuestion && state.questionAnswers) {
      const questionId = currentQuestion.plainQuestion.questionId;

      // Skip if we've already processed this question
      if (lastProcessedQuestionRef.current === questionId) {
        return;
      }

      const savedAnswer = state.questionAnswers[questionId];

      // Show previous answers in review mode OR when continuing a session (even if not in review mode)
      if (
        savedAnswer &&
        (effectiveReviewMode || state.questionAnswers[questionId])
      ) {
        // Set the selected answer
        dispatch({ type: "SET_SELECTED_ANSWER", payload: savedAnswer });

        // Check if the answer was correct
        const correctAnswers = currentQuestion.correct_answer.map((e) =>
          e.trim()
        );
        const isCorrect = correctAnswers.includes(savedAnswer.trim());

        // Set answer as checked with correct status
        dispatch({
          type: "SET_ANSWER_CHECKED",
          payload: {
            checked: true,
            correct: isCorrect,
            questionId,
            answer: savedAnswer,
            timeElapsed: state.questionTimes[questionId] || 0,
            externalId: currentQuestion?.externalid || null,
            ibn: currentQuestion?.ibn || null,
            plainQuestion: currentQuestion?.plainQuestion,
          },
        });
      } else if (!savedAnswer && !effectiveReviewMode) {
        // If no saved answer and not in review mode, reset to allow new answers
        dispatch({ type: "SET_SELECTED_ANSWER", payload: "" });
        dispatch({
          type: "SET_ANSWER_CHECKED",
          payload: {
            checked: false,
            correct: false,
            questionId,
            answer: "",
            timeElapsed: 0,
            externalId: currentQuestion?.externalid || null,
            ibn: currentQuestion?.ibn || null,
            plainQuestion: currentQuestion?.plainQuestion,
          },
        });
      }

      // Mark this question as processed
      lastProcessedQuestionRef.current = questionId;
    } else if (!currentQuestion) {
      // Reset the ref when no current question
      lastProcessedQuestionRef.current = null;
    }
  }, [
    effectiveReviewMode,
    currentQuestion,
    state.questionAnswers,
    state.questionTimes,
  ]);
  const steps = useMemo(
    () => [
      {
        id: "preparing",
        title: "Prepare",
        content: "Preparing Practice",
      },
      {
        id: "querying",
        title: "Querying",
        content: "Querying Questions 🔍",
      },
      {
        id: "fetching-questions",
        title: "Fetching Each Question",
        content: state.isLoadingNextBatch
          ? `Loading Next Batch... (${state.questionsProcessedCount}/22)`
          : state.questionsProcessedCount > 0 && state.totalQuestionsToFetch > 0
          ? state.questionsProcessedCount <=
            Math.floor(state.totalQuestionsToFetch / 2)
            ? `Fetching Questions... (${
                state.questionsProcessedCount
              }/${Math.floor(state.totalQuestionsToFetch / 2)})`
            : `Verifying Questions... (${
                state.questionsProcessedCount -
                Math.floor(state.totalQuestionsToFetch / 2)
              }/${Math.floor(state.totalQuestionsToFetch / 2)})`
          : "Fetching Each Question 🔍",
      },
      {
        id: "verifying",
        title: "Verifying",
        content:
          state.questionsProcessedCount > 0 &&
          state.totalQuestionsToFetch > 0 &&
          state.questionsProcessedCount <=
            Math.floor(state.totalQuestionsToFetch / 2)
            ? `Verifying Questions... (${
                state.questionsProcessedCount
              }/${Math.floor(state.totalQuestionsToFetch / 2)})`
            : "Verifying Questions...",
      },
      {
        id: "launching",
        title: "Launching Practice",
        content: "Launching Practice... 🚀",
      },
    ],
    [
      state.isLoadingNextBatch,
      state.questionsProcessedCount,
      state.totalQuestionsToFetch,
    ]
  );

  // Initialize session when practice starts
  useEffect(() => {
    if (practiceSelections) {
      // Pass restored session data if available
      dispatch({
        type: "INITIALIZE_SESSION",
        payload: {
          practiceSelections,
          totalQuestions: 0,
          restoredSessionData,
        },
      });
    }
  }, [practiceSelections, restoredSessionData]);

  // Auto-save session every 30 seconds
  useEffect(() => {
    const interval = setInterval(() => {
      if (!isSavingRef.current) {
        saveCurrentSession();
      }
    }, 30000); // Save every 30 seconds

    return () => clearInterval(interval);
  }, [saveCurrentSession]);

  // Save session when question is answered (debounced)
  const questionAnswersCount = Object.keys(state.questionAnswers).length;
  useEffect(() => {
    if (questionAnswersCount > 0 && !isSavingRef.current) {
      // Debounce to avoid too frequent saves
      const timeoutId = setTimeout(() => {
        saveCurrentSession();
      }, 1000);

      return () => clearTimeout(timeoutId);
    }
  }, [questionAnswersCount, saveCurrentSession]);

  // Save session when user progresses to next question (debounced)
  useEffect(() => {
    if (state.currentQuestionStep > 0 && !isSavingRef.current) {
      // Debounce to avoid too frequent saves
      const timeoutId = setTimeout(() => {
        saveCurrentSession();
      }, 1000);

      return () => clearTimeout(timeoutId);
    }
  }, [state.currentQuestionStep, saveCurrentSession]);

  // Save session before page unload
  useEffect(() => {
    const handleBeforeUnload = () => {
      if (!isSavingRef.current) {
        // Use a synchronous save for page unload
        if (state.questions && state.questions.length > 0) {
          // Calculate correct answers by comparing user answers with correct answers
          const answeredQuestions = Object.keys(state.questionAnswers).filter(
            (id) => state.questionAnswers[id] !== null
          );

          let correctAnswersCount = 0;
          answeredQuestions.forEach((questionId) => {
            const userAnswer = state.questionAnswers[questionId];

            const question = state.questions?.find(
              (q) => q.plainQuestion.questionId === questionId
            );

            if (question && userAnswer && question.correct_answer) {
              // Handle both single correct answer and multiple correct answers
              const correctAnswers = Array.isArray(question.correct_answer)
                ? question.correct_answer
                : [question.correct_answer];

              if (correctAnswers.map((e) => e.trim()).includes(userAnswer)) {
                correctAnswersCount++;
              }
            }
          });

          const currentSession: PracticeSession & {
            correctAnswers?: number;
            accuracyPercentage?: number;
          } = {
            sessionId: state.sessionId,
            timestamp: new Date(state.sessionStartTime).toISOString(),
            status:
              restoredSessionData &&
              (restoredSessionData.status as string) === "completed"
                ? SessionStatus.COMPLETED
                : SessionStatus.IN_PROGRESS,
            practiceSelections,
            currentQuestionStep: state.currentQuestionStep,
            questionAnswers: state.questionAnswers,
            questionTimes: state.questionTimes,
            answeredQuestionDetails: state.answeredQuestionDetails,
            totalQuestions: state.questions.length,
            answeredQuestions,
            correctAnswers: correctAnswersCount,
            accuracyPercentage:
              answeredQuestions.length > 0
                ? Math.round(
                    (correctAnswersCount / answeredQuestions.length) * 100
                  )
                : 0,
            averageTimePerQuestion:
              Object.keys(state.questionTimes).length > 0
                ? Object.values(state.questionTimes).reduce(
                    (sum, time) => sum + time,
                    0
                  ) / Object.keys(state.questionTimes).length
                : 0,
            totalTimeSpent: Object.values(state.questionTimes).reduce(
              (sum, time) => sum + time,
              0
            ),
            totalXPReceived: state.sessionXPReceived, // Include session XP tracking
          };
          try {
            localStorage.setItem(
              "currentPracticeSession",
              JSON.stringify(currentSession)
            );
          } catch (error) {
            console.error("Failed to save session on unload:", error);
          }
        }
      }
    };

    window.addEventListener("beforeunload", handleBeforeUnload);
    return () => window.removeEventListener("beforeunload", handleBeforeUnload);
  }, [
    state.questions,
    state.sessionId,
    state.sessionStartTime,
    state.currentQuestionStep,
    state.questionAnswers,
    state.questionTimes,
    state.answeredQuestionDetails,
    state.sessionXPReceived,
    practiceSelections,
    restoredSessionData,
  ]);

  // Function to handle session completion
  const completeSession = useCallback(() => {
    // Calculate correct answers by comparing user answers with correct answers
    const answeredQuestions = Object.keys(state.questionAnswers).filter(
      (id) => state.questionAnswers[id] !== null
    );

    let correctAnswersCount = 0;
    answeredQuestions.forEach((questionId) => {
      const userAnswer = state.questionAnswers[questionId];

      const question = state.questions?.find(
        (q) => q.plainQuestion.questionId === questionId
      );

      // console.log("User Answer:", userAnswer);
      // console.log("Question ID:", questionId);
      // console.log("Question Data:", question);

      if (question && userAnswer && question.correct_answer) {
        // Handle both single correct answer and multiple correct answers
        const correctAnswers = Array.isArray(question.correct_answer)
          ? question.correct_answer
          : [question.correct_answer];

        if (correctAnswers.map((e) => e.trim()).includes(userAnswer)) {
          correctAnswersCount++;
        }
      }
    });

    const completedSession: PracticeSession & {
      correctAnswers?: number;
      accuracyPercentage?: number;
    } = {
      sessionId: state.sessionId,
      timestamp: new Date(state.sessionStartTime).toISOString(),
      status: SessionStatus.COMPLETED,
      practiceSelections,
      currentQuestionStep: state.currentQuestionStep,
      questionAnswers: state.questionAnswers,
      questionTimes: state.questionTimes,
      answeredQuestionDetails: state.answeredQuestionDetails,
      totalQuestions: state.questions?.length || 0,
      answeredQuestions,
      correctAnswers: correctAnswersCount,
      accuracyPercentage:
        answeredQuestions.length > 0
          ? Math.round((correctAnswersCount / answeredQuestions.length) * 100)
          : 0,
      averageTimePerQuestion:
        Object.keys(state.questionTimes).length > 0
          ? Object.values(state.questionTimes).reduce(
              (sum, time) => sum + time,
              0
            ) / Object.keys(state.questionTimes).length
          : 0,
      totalTimeSpent: Object.values(state.questionTimes).reduce(
        (sum, time) => sum + time,
        0
      ),
      totalXPReceived: state.sessionXPReceived, // Include session XP tracking
    };

    try {
      // Save completed session to history
      const existingSessions = localStorage.getItem("practiceHistory");
      const sessions: PracticeSession[] = existingSessions
        ? JSON.parse(existingSessions)
        : [];

      // Update or add the completed session
      const existingIndex = sessions.findIndex(
        (session) => session.sessionId === state.sessionId
      );
      if (existingIndex !== -1) {
        sessions[existingIndex] = completedSession;
      } else {
        sessions.push(completedSession);
      }

      localStorage.setItem("practiceHistory", JSON.stringify(sessions));

      // Clear current session since it's completed
      localStorage.removeItem("currentPracticeSession");

      console.log("Practice session completed and saved!", completedSession);
      console.log("Session ID:", completedSession.sessionId);
      console.log(
        "Total questions answered:",
        completedSession.answeredQuestions.length
      );
      console.log(
        "Total time spent:",
        Math.round(completedSession.totalTimeSpent / 1000),
        "seconds"
      );

      // Call the parent callback with completed session data
      if (onSessionComplete) {
        let correctAnswers: { [questionId: string]: Array<string> } = {};
        console.log("questions data", state.questions);
        state.questions?.forEach((q) => {
          correctAnswers[q.plainQuestion.questionId] = q.correct_answer;
        });

        onSessionComplete(completedSession, correctAnswers);
      }
    } catch (error) {
      console.error("Failed to save completed session:", error);
      toast.error("Failed to Save Session Results", {
        description:
          "Your session results couldn't be saved. Your progress is still preserved locally.",
        duration: 5000,
      });
    }
  }, [
    state.sessionId,
    state.sessionStartTime,
    state.currentQuestionStep,
    state.questionAnswers,
    state.questionTimes,
    state.answeredQuestionDetails,
    state.questions,
    state.sessionXPReceived,
    practiceSelections,
    onSessionComplete,
  ]);

  // Scroll to top when question step changes
  useEffect(() => {
    if (effectiveReviewMode) return; // Don't scroll in review mode
    window.scrollTo({ top: 0, behavior: "smooth" });
    // Don't reset question state - let SET_CURRENT_QUESTION_STEP handle the state properly
    // dispatch({ type: "RESET_QUESTION_STATE" });
  }, [state.currentQuestionStep]);

  // Track if we've already fetched questions for current selections to prevent multiple calls
  const hasFetchedRef = useRef(false);
  const currentSelectionsRef = useRef<string>("");
  const isFetchingRef = useRef(false);

  // Helper function to fetch individual question details and convert to QuestionState
  const fetchQuestionDetails = useCallback(
    async (
      questionsToFetch: PlainQuestionType[],
      existingQuestions: QuestionState[] = [],
      showProgress: boolean = false
    ): Promise<QuestionState[]> => {
      const questions: {
        plainQuestion: PlainQuestionType;
        data: API_Response_Question;
      }[] = [];
      const correctQuestions: QuestionState[] = [...existingQuestions];

      // Set total questions to fetch if showing progress
      // Double the count to account for both fetching and verifying phases
      if (showProgress) {
        dispatch({
          type: "SET_TOTAL_QUESTIONS_TO_FETCH",
          payload: questionsToFetch.length * 2,
        });
        dispatch({ type: "SET_QUESTIONS_PROCESSED_COUNT", payload: 0 });
      }

      for (let i = 0; i < questionsToFetch.length; i++) {
        const question = questionsToFetch[i];

        // Update progress if showing progress (fetching phase)
        if (showProgress) {
          dispatch({ type: "SET_QUESTIONS_PROCESSED_COUNT", payload: i + 1 });
        }

        const questionData: API_Response_Question =
          await fetchQuestionsbyIBN_ExternalId(
            question.external_id
              ? question.external_id
              : question.ibn
              ? question.ibn
              : ""
          );

        if (questionData && questionData.correct_answer)
          questions.push({ plainQuestion: question, data: questionData });
      }

      // Update progress to show completion of fetching phase
      if (showProgress) {
        dispatch({
          type: "SET_QUESTIONS_PROCESSED_COUNT",
          payload: questionsToFetch.length,
        });
      }

      for (let i = 0; i < questions.length; i++) {
        const question = questions[i];
        const plainQuestion = question.plainQuestion;
        const questionsData = question.data;

        // Update progress during verification phase if showing progress
        if (showProgress) {
          dispatch({
            type: "SET_QUESTIONS_PROCESSED_COUNT",
            payload: questionsToFetch.length + i + 1,
          });
        }

        if (
          questionsData.correct_answer &&
          Array.isArray(questionsData.correct_answer) &&
          questionsData.correct_answer.length > 0
        ) {
          correctQuestions.push({
            ...questionsData,
            correct_answer: questionsData.correct_answer,
            plainQuestion: plainQuestion,
          });
        }
      }

      return correctQuestions;
    },
    []
  );

  // Helper function to fetch and process questions based on selections
  const fetchAndProcessQuestions = useCallback(
    async (
      questionsData: API_Response_Question_List,
      selections: PracticeSelections,
      existingQuestions: QuestionState[] = []
    ): Promise<QuestionState[]> => {
      const isRandomized = selections.randomize;
      const difficultiesChosen = selections.difficulties;

      let questionsToFetch: PlainQuestionType[];

      if (isRandomized && difficultiesChosen && difficultiesChosen.length > 0) {
        // Filter questions by selected difficulties
        const questionsByDifficulty: {
          [key: string]: PlainQuestionType[];
        } = {};

        // Group questions by difficulty
        difficultiesChosen.forEach((difficulty) => {
          questionsByDifficulty[difficulty] = questionsData.filter(
            (question: PlainQuestionType) => question.difficulty === difficulty
          );
        });

        let totalQuestions = 0;

        if (existingQuestions && existingQuestions.length > 0) {
          const benchmarkQuestionsLength = existingQuestions.length % 22;
          // console.log(`benchmarkQuestionsLength ${benchmarkQuestionsLength}`);
          totalQuestions = Math.min(22 - benchmarkQuestionsLength, 22);
        } else {
          totalQuestions = 22; // Default to 22 if no existing questions
        }

        const questionsPerDifficulty = Math.floor(
          totalQuestions / difficultiesChosen.length
        );
        const remainder = totalQuestions % difficultiesChosen.length;

        const selectedQuestions: PlainQuestionType[] = [];

        difficultiesChosen.forEach((difficulty, index) => {
          const questionsForThisDifficulty =
            questionsByDifficulty[difficulty] || [];

          // Add one extra question to the first 'remainder' difficulties to distribute the remainder
          const questionsToTakeFromThisDifficulty =
            questionsPerDifficulty + (index < remainder ? 1 : 0);

          // console.log(
          //   `Selecting ${questionsToTakeFromThisDifficulty} questions from difficulty ${difficulty}`
          // );

          // Shuffle questions for this difficulty and take the required amount
          const shuffledQuestions = [...questionsForThisDifficulty].sort(
            () => Math.random() - 0.5
          );
          const selectedFromThisDifficulty = shuffledQuestions.slice(
            0,
            questionsToTakeFromThisDifficulty
          );

          selectedQuestions.push(...selectedFromThisDifficulty);

          // console.log(
          //   `Selected ${selectedFromThisDifficulty.length} questions from difficulty ${difficulty}`
          // );
        });

        // console.log(
        //   `existingQuestions ${existingQuestions} ${existingQuestions.length}`
        // );
        // console.log(
        //   `Total Questions totalQuestions ${totalQuestions}: (from ${difficultiesChosen.length} difficulties)`
        // );

        // console.log(`REMAINDER ${remainder} questions`);

        questionsToFetch = selectedQuestions;
        // console.log("THIS IS A NEW VERSION (should be)");

        dispatch({
          type: "SET_TOTAL_QUESTIONS_TO_FETCH",
          payload: questionsToFetch.length * 2,
        });
        dispatch({ type: "SET_QUESTIONS_PROCESSED_COUNT", payload: 0 });

        console.log(
          `Total questions after difficulty-based selection: ${questionsToFetch.length}`
        );
      } else {
        let questionsNeeded = 0;

        if (existingQuestions && existingQuestions.length > 0) {
          const benchmarkQuestionsLength = existingQuestions.length % 22;
          // console.log(`benchmarkQuestionsLength ${benchmarkQuestionsLength}`);
          questionsNeeded = Math.min(22 - benchmarkQuestionsLength, 22);
        } else {
          questionsNeeded = 22; // Default to 22 if no existing questions
        }

        questionsToFetch = questionsData.slice(0, questionsNeeded);
      }

      return await fetchQuestionDetails(
        questionsToFetch,
        existingQuestions,
        true
      );
    },
    [fetchQuestionDetails]
  );

  const FetchQuestions = useCallback(
    async (selections: PracticeSelections) => {
      // Prevent multiple simultaneous calls
      if (isFetchingRef.current) {
        console.log("⏳ FetchQuestions already in progress, skipping...");
        return;
      }

      // Additional safeguard: Don't fetch if we're in review mode and already have questions
      if (
        effectiveReviewMode &&
        state.questions &&
        state.questions.length > 0
      ) {
        console.log(
          "🔍 Review mode: Questions already loaded in state, skipping fetch"
        );
        return;
      }

      isFetchingRef.current = true;

      try {
        console.log("Selections : ", selections);

        let lookupData: LookupRequest | undefined = state.lookupData;
        const lookupResponse = await fetch("/api/lookup")
          .then((res) => res.json())
          .catch((error) => {
            console.error("Error fetching questions:", error);
            toast.error("Failed to Fetch Questions", {
              description:
                "Unable to load practice questions. Please check your connection and try again.",
              duration: 5000,
            });
            return [];
          });

        console.log("lookupResponse", lookupResponse);
        if ("data" in lookupResponse) {
          lookupData = lookupResponse.data || null;
          console.log("lookupData", lookupData);

          if (lookupData) {
            dispatch({ type: "SET_LOOKUP_DATA", payload: lookupData });
          }
        }

        // Handle review mode - only fetch previously answered questions
        // This includes: explicit review mode OR sessions with COMPLETED status
        if (effectiveReviewMode && restoredSessionData) {
          console.log(
            "🔍 Review mode detected - loading only answered questions..."
          );

          const answeredQuestionDetails =
            restoredSessionData.answeredQuestionDetails || [];
          const answeredQuestionIds = Object.keys(
            restoredSessionData.questionAnswers || {}
          );

          console.log("📊 Review session details:", {
            sessionId: restoredSessionData.sessionId,
            status: restoredSessionData.status,
            totalAnswered: answeredQuestionIds.length,
            detailsCount: answeredQuestionDetails.length,
          });

          if (
            answeredQuestionDetails.length === 0 &&
            answeredQuestionIds.length === 0
          ) {
            toast.error("No Answered Questions Found", {
              description: "This session has no answered questions to review.",
              duration: 5000,
            });
            return;
          }

          dispatch({ type: "SET_CURRENT_STEP", payload: 3 });

          // Extract plain questions from answered question details
          const validPlainQuestions = answeredQuestionDetails
            .map((item) => item.plainQuestion)
            .filter((q) => q !== null) as PlainQuestionType[];

          if (validPlainQuestions.length > 0) {
            // Use the helper function to fetch only the answered questions
            const reviewQuestions = await fetchQuestionDetails(
              validPlainQuestions,
              [],
              true // Enable progress tracking for review sessions
            );

            dispatch({ type: "SET_CURRENT_STEP", payload: 4 });

            // Restore the session state including answers and timing data
            console.log("🔄 Restoring review session state...");

            // Dispatch restored session data for review
            dispatch({
              type: "RESTORE_SESSION_STATE",
              payload: {
                questionAnswers: restoredSessionData.questionAnswers || {},
                questionTimes: restoredSessionData.questionTimes || {},
                answeredQuestionDetails:
                  restoredSessionData.answeredQuestionDetails || [],
                currentQuestionStep: 0, // Start from first question in review mode
                sessionStartTime: new Date(
                  restoredSessionData.timestamp
                ).getTime(),
                sessionId: restoredSessionData.sessionId,
              },
            });

            dispatch({ type: "SET_CURRENT_STEP", payload: 5 });

            dispatch({ type: "SET_QUESTIONS", payload: reviewQuestions });
            dispatch({ type: "SET_CURRENT_STEP", payload: 5 });

            // Don't start timer in review mode
            console.log("✅ Review session loaded - questions are read-only");

            const answeredCount = Object.keys(
              restoredSessionData.questionAnswers || {}
            ).length;
            const correctAnswers = Object.keys(
              restoredSessionData.questionAnswers || {}
            ).filter((questionId) => {
              const userAnswer =
                restoredSessionData.questionAnswers?.[questionId];
              const question = reviewQuestions.find(
                (q) => q.plainQuestion.questionId === questionId
              );
              return (
                userAnswer &&
                question?.correct_answer
                  ?.map((a) => a.trim())
                  .includes(userAnswer)
              );
            }).length;

            toast.success("Review Session Loaded! 👁️", {
              description: `Reviewing ${answeredCount} answered questions (${correctAnswers} correct). Answers are read-only.`,
              duration: 6000,
            });

            return;
          } else {
            console.warn("No valid questions found in review session data");
            toast.error("Invalid Review Session", {
              description:
                "The session data doesn't contain valid question information.",
              duration: 5000,
            });
            return;
          }
        }

        // Normal flow for new sessions or when no restored data is available
        console.log(
          "🔄 No restored session data found, fetching from /api/get-questions..."
        );

        let excludeQuestionsIds: string[] = [];
        let otherParams = "";

        if (!selections.questionIds) {
          // load practiceStatistics local storage, and get the current assessment statistics
          const practiceStatistics = localStorage.getItem("practiceStatistics");
          const assessmentStatistics: PracticeStatistics = practiceStatistics
            ? JSON.parse(practiceStatistics)
            : {};

          if (selections.assessment in assessmentStatistics) {
            const currentAssessmentStatistics =
              assessmentStatistics[selections.assessment];
            console.log(currentAssessmentStatistics);

            if (currentAssessmentStatistics?.answeredQuestions) {
              excludeQuestionsIds =
                currentAssessmentStatistics.answeredQuestions;
              otherParams = `&excludeIds=${excludeQuestionsIds.join(",")}`;
            }
          }
        }

        // filter questions that already answered in the session
        if (restoredSessionData && restoredSessionData.answeredQuestions) {
          // Filter out questions that were already answered in the session
          const answeredQuestionIds =
            restoredSessionData.answeredQuestionDetails.map(
              (e) => e.questionId
            );

          // Combine already answered questions from both sources
          const allAnsweredQuestions = [
            ...excludeQuestionsIds,
            ...answeredQuestionIds,
          ];
          excludeQuestionsIds = [...new Set(allAnsweredQuestions)]; // Remove duplicates
          otherParams = `&excludeIds=${excludeQuestionsIds.join(",")}`;
        }

        let questionsData: API_Response_Question_List | null =
          state.questionsData;

        if (!questionsData) {
          const questionsResponse = await fetch(
            `/api/get-questions?assessment=${
              selections.assessment
            }&domains=${selections.domains
              .map((d) => d.primaryClassCd)
              .join(",")}&difficulties=${selections.difficulties.join(
              ","
            )}&skills=${selections.skills
              .map((s) => s.skill_cd)
              .join(",")}${otherParams}`
          )
            .then((res) => res.json())
            .catch((error) => {
              console.error("Error fetching questions:", error);
              toast.error("Failed to Fetch Questions", {
                description:
                  "Unable to load practice questions. Please check your connection and try again.",
                duration: 5000,
              });
              return [];
            });
          questionsData = questionsResponse.data || null;

          // Cache the questions data with the selections hash for future reuse
        }

        // Create a hash of the practice selections to check cache compatibility
        const selectionsHash = JSON.stringify({
          assessment: selections.assessment,
          domains: selections.domains?.map((d) => d.primaryClassCd).sort(),
          difficulties: selections.difficulties?.sort(),
          skills: selections.skills?.map((s) => s.skill_cd).sort(),
          // Don't include questionIds in hash as those are for shared links
        });

        if (questionsData && !state.questionsData) {
          console.log(`questionsData before excluding ${questionsData.length}`);

          console.log("STATE LOOKUP ", lookupData);
          // if user want to exluce Bluebook questions
          if (selections.excludeBluebook && lookupData) {
            questionsData = questionsData.filter((item) => {
              if (!item.external_id) {
                return true;
              }

              if (selections.subject == "reading-writing") {
                return !lookupData.readingLiveItems.includes(item.external_id);
              }

              if (selections.subject == "math") {
                return !lookupData.mathLiveItems.includes(item.external_id);
              }

              return true;
            });
          } else if (!lookupData) {
            // sonner
          }

          console.log(
            `selections.excludeBluebook ${selections.excludeBluebook} : ${questionsData.length}`
          );

          dispatch({
            type: "SET_QUESTIONS_DATA",
            payload: questionsData,
            selectionsHash: selectionsHash,
          });
        }

        if (!questionsData) {
          console.error("No questions data available after fetching");
          toast.error("No Questions Available", {
            description:
              "The server didn't return any questions. Please try again later.",
            duration: 5000,
          });
          isFetchingRef.current = false;
          return;
        }

        // Check if we have restored session data with previously answered questions
        if (
          restoredSessionData?.answeredQuestionDetails &&
          restoredSessionData.answeredQuestionDetails.length > 0
        ) {
          console.log("🔄 Restoring session from restored session data...");

          const questionDetails = restoredSessionData.answeredQuestionDetails;
          console.log(
            "Restoring previously answered questions:",
            questionDetails
          );

          dispatch({ type: "SET_CURRENT_STEP", payload: 3 });

          // Extract plain questions from restored session data
          const validPlainQuestions = questionDetails
            .map((item) => item.plainQuestion)
            .filter((q) => q !== null) as PlainQuestionType[];

          if (validPlainQuestions.length > 0) {
            // Use the helper function to fetch the restored questions
            const restoredQuestions = await fetchQuestionDetails(
              validPlainQuestions,
              [],
              true // Enable progress tracking for restored sessions
            );

            dispatch({ type: "SET_CURRENT_STEP", payload: 4 });

            // Restore the session state including answers and timing data
            console.log("🔄 Restoring session state...");

            // Extract answers and times from the restored session data
            const restoredAnswers = restoredSessionData.questionAnswers || {};
            const restoredTimes = restoredSessionData.questionTimes || {};
            const restoredAnsweredDetails =
              restoredSessionData.answeredQuestionDetails || [];

            // Dispatch restored session data
            dispatch({
              type: "RESTORE_SESSION_STATE",
              payload: {
                questionAnswers: restoredAnswers,
                questionTimes: restoredTimes,
                answeredQuestionDetails: restoredAnsweredDetails,
                currentQuestionStep:
                  restoredSessionData.currentQuestionStep || 0,
                sessionStartTime: new Date(
                  restoredSessionData.timestamp
                ).getTime(),
                sessionId: restoredSessionData.sessionId,
              },
            });

            console.log("✅ Session state restored successfully");
            console.log("📊 Restored session summary:", {
              answeredQuestions: Object.keys(restoredAnswers).length,
              totalTimeSpent: Object.values(restoredTimes).reduce(
                (sum, time) => sum + time,
                0
              ),
              sessionId: restoredSessionData.sessionId,
              currentStep: restoredSessionData.currentQuestionStep || 0,
            });

            // Now fetch new questions to continue the session
            const restoredSelections = restoredSessionData.practiceSelections;

            console.log(
              "🔄 Fetching new questions with restored selections...",
              restoredSelections
            );

            let finalQuestions = restoredQuestions;

            if (questionsData.length > 0) {
              console.log(
                `✅ Fetched ${questionsData.length} new questions to add to restored session`
              );

              // Use the helper function to process new questions and combine with restored ones
              finalQuestions = await fetchAndProcessQuestions(
                questionsData,
                restoredSelections,
                restoredQuestions
              );

              console.log(
                `✅ Total questions after combining restored + new: ${finalQuestions.length}`
              );
            } else {
              console.log(
                "No new questions available, continuing with restored questions only"
              );
            }

            dispatch({ type: "SET_CURRENT_STEP", payload: 5 });

            finalQuestions = selections.randomize
              ? [
                  ...finalQuestions.slice(0, restoredQuestions.length),
                  ...[
                    ...finalQuestions
                      .slice(restoredQuestions.length, finalQuestions.length)
                      .slice(),
                  ].sort(() => Math.random() - 0.5),
                ]
              : finalQuestions;

            // setTimeout(() => {
            dispatch({ type: "SET_QUESTIONS", payload: finalQuestions });
            dispatch({ type: "SET_CURRENT_STEP", payload: 5 });

            // Don't start timer immediately - user is reviewing restored session
            console.log(
              "🎯 Session restored - user can review previous answers"
            );

            // Show a toast to inform user about restored session
            const answeredCount = Object.keys(restoredAnswers).length;
            const correctAnswers = Object.keys(restoredAnswers).filter(
              (questionId) => {
                const userAnswer = restoredAnswers[questionId];
                const question = finalQuestions.find(
                  (q) => q.plainQuestion.questionId === questionId
                );
                return (
                  userAnswer &&
                  question?.correct_answer
                    ?.map((a) => a.trim())
                    .includes(userAnswer)
                );
              }
            ).length;

            toast.success("Session Restored Successfully! 🎯", {
              description: `Restored ${answeredCount} previously answered questions (${correctAnswers} correct). You can review your answers and continue practicing.`,
              duration: 8000,
            });
            // }, 1500);

            return;
          } else {
            console.warn(
              "No valid questions found in restored session data, proceeding with normal fetch"
            );
          }
        }

        // If questionIds are provided in selections, use them directly
        if (
          questionsData &&
          selections.questionIds &&
          selections.questionIds.length > 0
        ) {
          console.log(
            "Using pre-selected questions from shared link:",
            selections.questionIds
          );

          dispatch({ type: "SET_CURRENT_STEP", payload: 3 });

          // Create mock questionsData from the provided questionIds
          const filteredQuestionsData: API_Response_Question_List =
            questionsData.filter((question) =>
              selections.questionIds?.includes(question.questionId)
            );

          // Use the helper function to fetch question details
          const correctQuestions = await fetchQuestionDetails(
            filteredQuestionsData,
            [],
            true
          );

          dispatch({ type: "SET_CURRENT_STEP", payload: 4 });
          dispatch({ type: "SET_CURRENT_STEP", payload: 5 });

          setTimeout(() => {
            // Apply randomization if requested
            // const finalQuestions = selections.randomize
            //   ? [...correctQuestions].sort(() => Math.random() - 0.5)
            //   : correctQuestions;

            dispatch({ type: "SET_QUESTIONS", payload: correctQuestions });
            dispatch({ type: "SET_CURRENT_STEP", payload: 5 });
            dispatch({ type: "START_TIMER" });
          }, 1500);

          return;
        }

        if (questionsData) {
          console.log(
            "✅ Successfully fetched questions data from API, caching for future use"
          );

          dispatch({ type: "SET_CURRENT_STEP", payload: 3 });

          console.log("selections", selections);

          // Use the helper function to fetch and process questions
          const correctQuestions = await fetchAndProcessQuestions(
            questionsData,
            selections
          );

          dispatch({ type: "SET_CURRENT_STEP", payload: 4 });
          dispatch({ type: "SET_CURRENT_STEP", payload: 5 });

          setTimeout(() => {
            // if (correctQuestions && !state.questions)
            //   playSound("start-session.wav");
            const finalQuestions = selections.randomize
              ? [...correctQuestions].sort(() => Math.random() - 0.5)
              : correctQuestions;

            dispatch({ type: "SET_QUESTIONS", payload: finalQuestions });

            dispatch({ type: "SET_CURRENT_STEP", payload: 5 });

            dispatch({ type: "START_TIMER" }); // Start timer when questions are loaded
          }, 1500);
        }
      } catch (error) {
        console.error("Error in FetchQuestions:", error);
        toast.error("Failed to Load Practice Questions", {
          description:
            "An unexpected error occurred while loading questions. Please try again.",
          duration: 5000,
        });
      } finally {
        isFetchingRef.current = false;
      }
    },
    [
      state.questionsData,
      state.questions,
      restoredSessionData,
      effectiveReviewMode,
      fetchAndProcessQuestions,
      fetchQuestionDetails,
    ]
  );

  useEffect(() => {
    if (practiceSelections) {
      // Don't fetch questions if we're in review mode and already have questions loaded
      if (
        effectiveReviewMode &&
        state.questions &&
        state.questions.length > 0
      ) {
        console.log("🔍 Review mode: Questions already loaded, skipping fetch");
        return;
      }

      // Create a hash of current selections to check if they've changed
      const selectionsKey = JSON.stringify({
        assessment: practiceSelections.assessment,
        domains: practiceSelections.domains
          ?.map((d) => d.primaryClassCd)
          .sort(),
        difficulties: practiceSelections.difficulties?.sort(),
        skills: practiceSelections.skills?.map((s) => s.skill_cd).sort(),
        questionIds: practiceSelections.questionIds?.sort(),
        // Include review mode and session ID in hash to prevent fetching for same session
        effectiveReviewMode: effectiveReviewMode,
        sessionId: restoredSessionData?.sessionId,
      });

      // Reset flags if selections have actually changed
      if (selectionsKey !== currentSelectionsRef.current) {
        hasFetchedRef.current = false;
        isFetchingRef.current = false;
        currentSelectionsRef.current = selectionsKey;
      }

      // Only fetch if we haven't already fetched for these selections and not currently fetching
      if (!hasFetchedRef.current && !isFetchingRef.current) {
        hasFetchedRef.current = true;
        dispatch({ type: "SET_CURRENT_STEP", payload: 2 });
        FetchQuestions(practiceSelections);
      }
    }
  }, [
    practiceSelections,
    FetchQuestions,
    effectiveReviewMode,
    state.questions,
    restoredSessionData?.sessionId,
  ]);

  async function fetchQuestionsbyIBN_ExternalId(id: string) {
    const questionResponse: { data: API_Response_Question } = await fetch(
      `/api/question/${id}`
    )
      .then((res) => res.json())
      .catch((error) => {
        console.error("Error fetching question:", error);
        toast.error("Failed to Load Question", {
          description: `Unable to load question ${id}. This question will be skipped.`,
          duration: 4000,
        });
        return null;
      });

    return questionResponse.data;
  }

  const loadNextBatch = useCallback(async () => {
    if (!state.questionsData || state.isLoadingNextBatch) {
      console.log("No more questions available or already loading");
      return;
    }

    // Check if there are more questions available
    const startIndex = state.questionsLoadedCount;

    const currentTotalLength = state.questions?.length;

    if (
      currentTotalLength &&
      state.questions &&
      currentTotalLength >= state.questions.length
    ) {
      console.log("No more questions available in the dataset");
      return;
    }

    dispatch({ type: "START_LOADING_NEXT_BATCH" });

    try {
      const isRandomized = practiceSelections?.randomize;
      const difficultiesChosen = practiceSelections?.difficulties;

      let questionsToFetch: PlainQuestionType[];

      if (
        isRandomized &&
        state.questions &&
        difficultiesChosen &&
        difficultiesChosen.length > 0
      ) {
        // Get remaining questions from questionsData starting from startIndex
        const remainingQuestions = state.questionsData.filter(
          (q) =>
            q.questionId &&
            !state.questions?.some(
              (loadedQ) => loadedQ.plainQuestion.questionId === q.questionId
            )
        );

        // Filter remaining questions by selected difficulties
        const questionsByDifficulty: {
          [key: string]: PlainQuestionType[];
        } = {};

        // Group remaining questions by difficulty
        difficultiesChosen.forEach((difficulty) => {
          questionsByDifficulty[difficulty] = remainingQuestions.filter(
            (question) => question.difficulty === difficulty
          );
        });

        // Calculate how many questions to take from each difficulty
        const totalQuestions = 22;
        const questionsPerDifficulty = Math.floor(
          totalQuestions / difficultiesChosen.length
        );
        const remainder = totalQuestions % difficultiesChosen.length;

        const selectedQuestions: PlainQuestionType[] = [];

        difficultiesChosen.forEach((difficulty, index) => {
          const questionsForThisDifficulty =
            questionsByDifficulty[difficulty] || [];

          // Add one extra question to the first 'remainder' difficulties to distribute the remainder
          const questionsToTakeFromThisDifficulty =
            questionsPerDifficulty + (index < remainder ? 1 : 0);

          // Shuffle questions for this difficulty and take the required amount
          const shuffledQuestions = [...questionsForThisDifficulty].sort(
            () => Math.random() - 0.5
          );
          const selectedFromThisDifficulty = shuffledQuestions.slice(
            0,
            questionsToTakeFromThisDifficulty
          );

          selectedQuestions.push(...selectedFromThisDifficulty);

          console.log(
            `Selected ${selectedFromThisDifficulty.length} questions from difficulty ${difficulty} for next batch`
          );
        });

        // Final shuffle of all selected questions
        questionsToFetch = selectedQuestions.sort(() => Math.random() - 0.5);

        console.log(
          `Total questions after difficulty-based selection for next batch: ${questionsToFetch.length}`
        );
      } else {
        // Original behavior for non-randomized or when no difficulties specified
        questionsToFetch = state.questionsData.slice(
          startIndex,
          startIndex + 22
        );
      }

      const questions: API_Response_Question[] = [];
      const correctQuestions: QuestionState[] = [];

      // Fetch individual question details
      for (let i = 0; i < questionsToFetch.length; i++) {
        const question = questionsToFetch[i];

        // Update progress
        dispatch({
          type: "SET_QUESTIONS_PROCESSED_COUNT",
          payload: i + 1,
        });

        const questionData: API_Response_Question =
          await fetchQuestionsbyIBN_ExternalId(
            question.ibn
              ? question.ibn
              : question.external_id
              ? question.external_id
              : ""
          );

        if (questionData) questions.push(questionData);
      }

      // Process questions to ensure they have correct answers
      for (let i = 0; i < questions.length; i++) {
        const question = questions[i];

        if (
          question.correct_answer &&
          Array.isArray(question.correct_answer) &&
          question.correct_answer.length > 0
        ) {
          correctQuestions.push({
            ...question,
            correct_answer: question.correct_answer,
            plainQuestion: questionsToFetch[i],
          });
        }
      }

      // Dispatch the new questions
      dispatch({
        type: "FINISH_LOADING_NEXT_BATCH",
        payload: correctQuestions,
      });
    } catch (error) {
      console.error("Error loading next batch:", error);
      toast.error("Failed to Load More Questions", {
        description:
          "Unable to load additional questions. You can continue with current questions or try again later.",
        duration: 5000,
      });
      // Reset loading state on error
      dispatch({ type: "SET_CURRENT_STEP", payload: 5 });
    }
  }, [
    state.questionsData,
    state.isLoadingNextBatch,
    state.questionsLoadedCount,
    practiceSelections,
  ]);

  const handleAnsweringQuestion = useCallback(
    (questionId: string) => {
      return () => {
        if (!currentQuestion) return;

        // In review mode, only allow navigation - no answer changes
        if (effectiveReviewMode) {
          playSound("button-pressed.wav");

          // Just move to next question if available
          if (
            state.questions &&
            state.currentQuestionStep < state.questions.length - 1
          ) {
            dispatch({
              type: "SET_CURRENT_QUESTION_STEP",
              payload: state.currentQuestionStep + 1,
            });
          }
          return;
        }

        // Check if this is a previously answered question being reviewed
        const isPreviouslyAnswered = Boolean(state.questionAnswers[questionId]);

        // For previously answered questions, we should always proceed to next question
        if (isPreviouslyAnswered) {
          playSound("button-pressed.wav");

          // Move to next question if available
          if (
            state.questions &&
            state.currentQuestionStep < state.questions.length - 1
          ) {
            dispatch({
              type: "SET_CURRENT_QUESTION_STEP",
              payload: state.currentQuestionStep + 1,
            });
          } else {
            // This was the last question in loaded questions - user can choose to continue or finish
            console.log(
              "Reached end of loaded questions. User can choose to continue or finish."
            );
            // Don't automatically load next batch or complete - let user decide via buttons
          }
          return;
        }

        // For new questions, we need a selected answer
        if (!state.selectedAnswer) return;

        if (!state.isAnswerChecked) {
          // First time answering this question
          const correctAnswers = currentQuestion.correct_answer.map((e) =>
            e.trim()
          );
          const correct = correctAnswers.includes(state.selectedAnswer.trim());

          // Play sound based on answer correctness
          if (correct) {
            playSound("correct-answer.wav");
            confettiRef.current?.fire({});
          } else {
            playSound("incorrect-answer.wav");
          }

          // Calculate time elapsed for this question
          const currentSessionTime = Date.now() - state.questionStartTime;
          const previousElapsedTime =
            state.inProgressQuestionTimes[questionId] ||
            state.currentQuestionElapsedTime;
          const timeElapsed = currentSessionTime + previousElapsedTime;

          dispatch({
            type: "SET_ANSWER_CHECKED",
            payload: {
              checked: true,
              correct,
              questionId,
              answer: state.selectedAnswer,
              timeElapsed,
              externalId: currentQuestion?.externalid || null,
              ibn: currentQuestion?.ibn || null,
              plainQuestion: currentQuestion?.plainQuestion, // Include plainQuestion data
            },
          });

          // Save statistics to localStorage
          try {
            const assessmentType =
              practiceSelections.assessment as AssessmentType;
            addQuestionStatistic({
              assessment: assessmentType,
              primaryClassCd: currentQuestion.plainQuestion.primary_class_cd,
              skillCd: currentQuestion.plainQuestion.skill_cd,
              questionId: currentQuestion.plainQuestion.questionId,
              external_id:
                currentQuestion.plainQuestion.external_id || undefined,
              ibn: currentQuestion.plainQuestion.ibn || undefined,
              plainQuestion: currentQuestion.plainQuestion, // Include full plainQuestion data
              statistic: {
                time: timeElapsed,
                answer: state.selectedAnswer,
                isCorrect: correct,
                external_id:
                  currentQuestion.plainQuestion.external_id || undefined,
                ibn: currentQuestion.plainQuestion.ibn || undefined,
                plainQuestion: currentQuestion.plainQuestion, // Include in statistic as well
              },
            });

            // Also save detailed answered question with difficulty
            addAnsweredQuestion(
              assessmentType,
              currentQuestion.plainQuestion.questionId,
              currentQuestion.plainQuestion.difficulty as "E" | "M" | "H",
              correct,
              timeElapsed,
              currentQuestion.plainQuestion, // Include plainQuestion data
              state.selectedAnswer // Include the selected answer
            );

            // Update user profile and XP based on answer correctness
            const scoreBandRange =
              currentQuestion.plainQuestion.score_band_range_cd;
            let updatedProfile;
            let sessionXPChange = 0;

            if (correct) {
              // Add XP for correct answer
              updatedProfile = addXPForCorrectAnswer(
                currentQuestion.plainQuestion.questionId,
                scoreBandRange
              );

              // Calculate session XP change
              sessionXPChange = scoreBandRange * 10;

              // Show XP gain notification
              const xpGain = scoreBandRange * 10;
              toast.success(`Correct! +${xpGain} XP! 🎯`, {
                description: `Total XP: ${updatedProfile.totalXP} | Level: ${updatedProfile.level}`,
                duration: 3000,
              });
            } else {
              // Reduce XP for incorrect answer
              updatedProfile = reduceXPForIncorrectAnswer(
                currentQuestion.plainQuestion.questionId,
                scoreBandRange
              );

              // Calculate session XP change (negative)
              sessionXPChange = -Math.floor((scoreBandRange * 10) / 2);

              // Show XP loss notification
              const xpLoss = Math.floor((scoreBandRange * 10) / 2);
              toast.error(`Incorrect. -${xpLoss} XP 💔`, {
                description: `Total XP: ${updatedProfile.totalXP} | Level: ${updatedProfile.level}`,
                duration: 3000,
              });
            }

            // Update session XP tracking
            dispatch({ type: "ADD_SESSION_XP", payload: sessionXPChange });

            // Update practice history immediately with new XP
            updateSessionXP(state.sessionId, sessionXPChange);

            console.log("📊 Updated user profile:", {
              totalXP: updatedProfile.totalXP,
              level: updatedProfile.level,
              questionsAnswered: updatedProfile.questionsAnswered,
              correctAnswers: updatedProfile.correctAnswers,
              incorrectAnswers: updatedProfile.incorrectAnswers,
              sessionXPChange,
            });

            // currentQuestion.plainQuestion.score_band_range_cd
          } catch (error) {
            console.error("Error saving question statistic:", error);
            toast.error("Failed to Save Statistics", {
              description:
                "Your answer was recorded but statistics couldn't be saved. You can continue practicing.",
              duration: 4000,
            });
          }

          // Stop the timer when answer is checked
          dispatch({ type: "STOP_TIMER" });

          // Note: The feedback overlay will handle the continue action
          // Don't advance to next question here - let overlay handle it
        } else {
          // Continuing after checking the answer for the first time
          playSound("button-pressed.wav");

          // Move to next question if available
          if (
            state.questions &&
            state.currentQuestionStep < state.questions.length - 1
          ) {
            dispatch({
              type: "SET_CURRENT_QUESTION_STEP",
              payload: state.currentQuestionStep + 1,
            });
          } else {
            // This was the last question in loaded questions - user can choose to continue or finish
            console.log(
              "Reached end of loaded questions. User can choose to continue or finish."
            );
            // Don't automatically load next batch or complete - let user decide via buttons
          }
        }
      };
    },
    [
      state.selectedAnswer,
      currentQuestion,
      state.isAnswerChecked,
      state.questions,
      state.currentQuestionStep,
      state.questionStartTime,
      state.currentQuestionElapsedTime,
      state.questionAnswers,
      state.inProgressQuestionTimes,
      state.sessionId,
      practiceSelections,
      effectiveReviewMode,
    ]
  );

  // Handle saving note
  const handleSaveNote = useCallback(
    (noteText: string) => {
      if (!currentQuestion) return;

      try {
        const questionId = currentQuestion.plainQuestion.questionId;
        const difficulty = currentQuestion.plainQuestion.difficulty;
        const primaryClassCd = currentQuestion.plainQuestion.primary_class_cd;
        const skillCd = currentQuestion.plainQuestion.skill_cd;
        const createdDate = currentQuestion.plainQuestion.createDate;
        const updatedDate = currentQuestion.plainQuestion.updateDate;
        const subject = getSubjectByPrimaryClassCd(primaryClassCd || "");
        const assessment = practiceSelections.assessment;
        const updatedNotes = { ...questionNotes };

        // If note is empty, delete it
        if (!noteText.trim()) {
          if (updatedNotes[assessment]) {
            updatedNotes[assessment] = updatedNotes[assessment].filter(
              (note: QuestionNote) => note.questionId !== questionId
            );
          }
          setQuestionNotes(updatedNotes);
          console.log("Note deleted successfully!");
          return;
        }

        // Initialize array if it doesn't exist
        if (!updatedNotes[assessment]) {
          updatedNotes[assessment] = [];
        }

        // Check if note already exists
        const noteIndex = updatedNotes[assessment].findIndex(
          (note: QuestionNote) => note.questionId === questionId
        );

        const now = new Date().toISOString();

        if (noteIndex === -1) {
          // Create new note
          const newNote: QuestionNote = {
            questionId,
            difficulty,
            primaryClassCd,
            skillCd,
            subject,
            createdDate,
            updatedDate,
            note: noteText,
            timestamp: now,
            createdAt: now,
          };
          updatedNotes[assessment].push(newNote);
        } else {
          // Update existing note
          updatedNotes[assessment][noteIndex] = {
            ...updatedNotes[assessment][noteIndex],
            difficulty,
            primaryClassCd,
            skillCd,
            subject,
            createdDate,
            updatedDate,
            note: noteText,
            timestamp: now,
          };
        }

        setQuestionNotes(updatedNotes);
        console.log("Note saved successfully!");
      } catch (error) {
        console.error("Failed to save note:", error);
      }
    },
    [
      currentQuestion,
      practiceSelections.assessment,
      questionNotes,
      setQuestionNotes,
    ]
  );

  // function handleExit() {
  //   // Show exit confirmation popup instead of directly exiting
  //   dispatch({ type: "TOGGLE_EXIT_CONFIRMATION" });
  // }

  function handleFinish() {
    // Show finish confirmation popup
    dispatch({ type: "TOGGLE_FINISH_CONFIRMATION" });
  }

  // Check if we're at the end of currently loaded questions and can load more
  const isAtEndOfBatch =
    state.questions && state.currentQuestionStep >= state.questions.length - 1;

  const canLoadMore =
    state.questionsData &&
    state.questionsLoadedCount < state.questionsData.length;

  function confirmFinish() {
    // Complete the session with current progress
    completeSession();
  }

  function confirmExit() {
    // Calculate correct answers by comparing user answers with correct answers
    const answeredQuestions = Object.keys(state.questionAnswers).filter(
      (id) => state.questionAnswers[id] !== null
    );

    let correctAnswersCount = 0;
    answeredQuestions.forEach((questionId) => {
      const userAnswer = state.questionAnswers[questionId];
      const question = state.questions?.find(
        (q) => q.plainQuestion.questionId === questionId
      );

      if (question && userAnswer && question.correct_answer) {
        // Handle both single correct answer and multiple correct answers
        const correctAnswers = Array.isArray(question.correct_answer)
          ? question.correct_answer
          : [question.correct_answer];

        if (correctAnswers.map((e) => e.trim()).includes(userAnswer)) {
          correctAnswersCount++;
        }
      }
    });

    // Save user's progress to local storage with ABANDONED status
    const abandonedSession: PracticeSession & {
      correctAnswers?: number;
      accuracyPercentage?: number;
    } = {
      sessionId: state.sessionId,
      timestamp: new Date(state.sessionStartTime).toISOString(),
      status: SessionStatus.ABANDONED,
      practiceSelections,
      currentQuestionStep: state.currentQuestionStep,
      questionAnswers: state.questionAnswers,
      questionTimes: state.questionTimes,
      answeredQuestionDetails: state.answeredQuestionDetails,
      totalQuestions: state.questions?.length || 0,
      answeredQuestions,
      correctAnswers: correctAnswersCount,
      accuracyPercentage:
        answeredQuestions.length > 0
          ? Math.round((correctAnswersCount / answeredQuestions.length) * 100)
          : 0,
      averageTimePerQuestion:
        Object.keys(state.questionTimes).length > 0
          ? Object.values(state.questionTimes).reduce(
              (sum, time) => sum + time,
              0
            ) / Object.values(state.questionTimes).length
          : 0,
      totalTimeSpent: Object.values(state.questionTimes).reduce(
        (sum, time) => sum + time,
        0
      ),
      totalXPReceived: state.sessionXPReceived, // Include session XP tracking
    };

    try {
      // Save session using localStorage directly
      const existingSessions = localStorage.getItem("practiceHistory");
      const sessions: PracticeSession[] = existingSessions
        ? JSON.parse(existingSessions)
        : [];

      // Update or add the abandoned session
      const existingIndex = sessions.findIndex(
        (session) => session.sessionId === state.sessionId
      );
      if (existingIndex !== -1) {
        sessions[existingIndex] = abandonedSession;
      } else {
        sessions.push(abandonedSession);
      }

      localStorage.setItem("practiceHistory", JSON.stringify(sessions));

      console.log("Practice session saved successfully as abandoned");
      console.log(
        "Question Times (in seconds):",
        Object.fromEntries(
          Object.entries(state.questionTimes).map(([id, time]) => [
            id,
            Math.round(time / 1000),
          ])
        )
      );

      // Call the parent callback with session data
      if (onSessionComplete) {
        router.push("/");
        // onSessionComplete(abandonedSession);
      }
    } catch (error) {
      console.error("Failed to save practice session:", error);
      toast.error("Failed to Save Session", {
        description:
          "Your session couldn't be saved before exiting. Some progress may be lost.",
        duration: 5000,
      });
    }
  }

  // console.log(currentQuestion?.plainQuestion);
  return (
    <React.Fragment>
      <div className="max-w-11/12 mx-auto px-4 sm:px-6 lg:px-8">
        {!currentQuestion ? (
          <div className="h-screen flex flex-col items-center justify-center gap-8">
            {/* OnboardCard Component */}
            <OnboardCard
              steps={steps}
              currentStep={state.currentStep}
              onStepChange={() => {
                // Step change handler
              }}
            />
          </div>
        ) : (
          <React.Fragment>
            <div className="min-h-screen items-center justify-center pt-32 pb-10">
              {effectiveReviewMode && (
                <div className="mb-6 p-4 bg-blue-100 border-2 border-blue-300 rounded-lg text-center">
                  <h4 className="text-lg font-bold text-blue-800 mb-1">
                    📚 Review Mode - Session ID: {state.sessionId}
                  </h4>
                  <p className="text-sm text-blue-600">
                    You are reviewing a completed practice session. All answers
                    are read-only.
                  </p>

                  {/* Question Results Grid */}
                  {state.questions && state.questions.length > 0 && (
                    <div className="mt-4 pt-4 border-t border-blue-100">
                      {/* Collapsible Header */}
                      <div
                        className="flex items-center justify-between cursor-pointer hover:bg-blue-50 rounded-lg p-2 transition-colors"
                        onClick={() => {
                          setIsGridCollapsed(!isGridCollapsed);
                          playSound("button-pressed.wav");
                        }}
                      >
                        <div className="text-sm font-medium text-blue-900">
                          Question Results (
                          {Object.keys(state.questionAnswers).length} answered)
                        </div>
                        <div className="flex items-center gap-1">
                          <span className="text-xs text-blue-600">
                            {isGridCollapsed ? "Show" : "Hide"}
                          </span>
                          {isGridCollapsed ? (
                            <ChevronDown className="w-4 h-4 text-blue-600" />
                          ) : (
                            <ChevronUp className="w-4 h-4 text-blue-600" />
                          )}
                        </div>
                      </div>

                      {/* Collapsible Content */}
                      <div
                        className={`transition-all duration-300 ease-in-out overflow-hidden ${
                          isGridCollapsed
                            ? "max-h-0 opacity-0"
                            : "max-h-[1000px] opacity-100"
                        }`}
                      >
                        <div className="mt-3">
                          <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-6 lg:grid-cols-8 gap-3 px-2">
                            {state.questions.map((question, idx) => {
                              const questionId =
                                question.plainQuestion.questionId;
                              const userAnswer =
                                state.questionAnswers[questionId];
                              const isAnswered = Boolean(userAnswer);
                              const isCorrect =
                                isAnswered &&
                                question.correct_answer
                                  .map((a) => a.trim())
                                  .includes(userAnswer?.trim() || "");
                              const timeSpent =
                                state.questionTimes[questionId] || 0;
                              const isCurrent =
                                state.currentQuestionStep === idx;

                              return (
                                <div
                                  key={questionId}
                                  onClick={() => {
                                    dispatch({
                                      type: "SET_CURRENT_QUESTION_STEP",
                                      payload: idx,
                                    });
                                  }}
                                  className={`relative p-3 rounded-lg border-2 text-center cursor-pointer transition-all duration-300 hover:shadow-md ${
                                    isCurrent
                                      ? "ring-2 ring-blue-400 scale-105 shadow-lg"
                                      : ""
                                  } ${
                                    !isAnswered
                                      ? "bg-white border-gray-200 text-gray-700 hover:bg-gray-50 hover:border-gray-300"
                                      : isCorrect
                                      ? "bg-green-50 border-green-200 text-green-800 hover:bg-green-100 hover:border-green-300"
                                      : "bg-red-50 border-red-200 text-red-800 hover:bg-red-100 hover:border-red-300"
                                  }`}
                                  title={`Question ${idx + 1} - ${
                                    question.plainQuestion.difficulty === "E"
                                      ? "Easy"
                                      : question.plainQuestion.difficulty ===
                                        "M"
                                      ? "Medium"
                                      : "Hard"
                                  }${
                                    isAnswered
                                      ? ` - ${
                                          isCorrect ? "Correct" : "Incorrect"
                                        } (${userAnswer})`
                                      : " - Not answered"
                                  } - Time: ${Math.floor(timeSpent / 1000)}s`}
                                >
                                  {/* Status indicator dot */}
                                  <div
                                    className={`absolute -top-1 -right-1 w-3 h-3 rounded-full border-2 border-white ${
                                      !isAnswered
                                        ? "bg-gray-400"
                                        : isCorrect
                                        ? "bg-green-500"
                                        : "bg-red-500"
                                    }`}
                                  />

                                  {/* Question number */}
                                  <div className="font-bold text-sm mb-1">
                                    Q{idx + 1}
                                  </div>

                                  {/* Difficulty badge */}
                                  <div
                                    className={`inline-flex items-center justify-center rounded text-xs font-bold mb-1 px-1 py-1 ${
                                      question.plainQuestion.difficulty === "E"
                                        ? "bg-green-200 text-green-800"
                                        : question.plainQuestion.difficulty ===
                                          "M"
                                        ? "bg-yellow-200 text-yellow-800"
                                        : "bg-red-200 text-red-800"
                                    }`}
                                  >
                                    {question.plainQuestion.difficulty === "E"
                                      ? "Easy"
                                      : question.plainQuestion.difficulty ===
                                        "M"
                                      ? "Medium"
                                      : "Hard"}
                                  </div>

                                  {/* Time spent */}
                                  <div className="text-xs text-gray-600 mb-1">
                                    {Math.floor(timeSpent / (1000 * 60))}m{" "}
                                    {Math.floor(
                                      (timeSpent % (1000 * 60)) / 1000
                                    )}
                                    s
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                          <div className="mt-4 p-3 bg-blue-50 rounded-lg border border-blue-200">
                            <div className="flex flex-wrap items-center justify-center gap-4 mb-2 text-xs">
                              <div className="flex items-center gap-1">
                                <div className="w-3 h-3 bg-green-500 rounded-full"></div>
                                <span className="text-green-700 font-medium">
                                  Correct
                                </span>
                              </div>
                              <div className="flex items-center gap-1">
                                <div className="w-3 h-3 bg-red-500 rounded-full"></div>
                                <span className="text-red-700 font-medium">
                                  Incorrect
                                </span>
                              </div>
                              <div className="flex items-center gap-1">
                                <div className="w-3 h-3 bg-gray-400 rounded-full"></div>
                                <span className="text-gray-700 font-medium">
                                  Not Answered
                                </span>
                              </div>
                            </div>
                            <div className="flex flex-wrap items-center justify-center gap-4 text-xs">
                              <div className="flex items-center gap-1">
                                <div className="w-5 h-4 bg-green-200 text-green-800 rounded text-xs font-bold flex items-center justify-center">
                                  E
                                </div>
                                <span className="text-blue-700">Easy</span>
                              </div>
                              <div className="flex items-center gap-1">
                                <div className="w-5 h-4 bg-yellow-200 text-yellow-800 rounded text-xs font-bold flex items-center justify-center">
                                  M
                                </div>
                                <span className="text-blue-700">Medium</span>
                              </div>
                              <div className="flex items-center gap-1">
                                <div className="w-5 h-4 bg-red-200 text-red-800 rounded text-xs font-bold flex items-center justify-center">
                                  H
                                </div>
                                <span className="text-blue-700">Hard</span>
                              </div>
                            </div>
                            <div className="mt-2 text-xs text-blue-600 text-center font-medium">
                              Click on any question to jump to it
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              )}
              <div className="w-full flex justify-start">
                {" "}
                <DuolingoTimer
                  startTime={state.questionStartTime}
                  isActive={state.isTimerActive}
                  isVisible={state.isTimerVisible}
                  onToggleVisibility={() => {
                    dispatch({ type: "TOGGLE_TIMER_VISIBILITY" });
                    playSound("button-pressed.wav");
                  }}
                  fixedTime={
                    state.questionAnswers[
                      currentQuestion.plainQuestion.questionId
                    ]
                      ? state.questionTimes[
                          currentQuestion.plainQuestion.questionId
                        ]
                      : undefined
                  }
                  savedElapsedTime={state.currentQuestionElapsedTime}
                />
              </div>

              <div className="grid grid-cols-12 justify-between mb-10">
                <div className="col-span-12 xl:col-span-5">
                  <div className="flex flex-col lg:flex-col gap-4 items-start">
                    <Pill className="text-md font-semibold">
                      {currentQuestion.plainQuestion.difficulty == "E" ? (
                        <React.Fragment>
                          <PillIndicator variant="success" pulse />
                          Easy
                        </React.Fragment>
                      ) : currentQuestion.plainQuestion.difficulty == "M" ? (
                        <React.Fragment>
                          <PillIndicator variant="warning" pulse />
                          Medium
                        </React.Fragment>
                      ) : (
                        <React.Fragment>
                          <PillIndicator variant="error" pulse />
                          Hard
                        </React.Fragment>
                      )}
                    </Pill>
                    <div className="h-full flex gap-2 justify-center items-center">
                      <div>
                        <h5 className="font-black text-2xl">
                          Question ID {currentQuestion.plainQuestion.questionId}
                        </h5>
                        <h6 className="text-xl">
                          {currentQuestion.plainQuestion.primary_class_cd_desc}{" "}
                          - {currentQuestion.plainQuestion.skill_desc}
                          {state.isSavingSession && (
                            <span className="ml-2 text-blue-600 text-xs">
                              • Saving...
                            </span>
                          )}
                          {state.questionAnswers[
                            currentQuestion.plainQuestion.questionId
                          ] && (
                            <span className="ml-2 text-orange-600 text-xs font-semibold">
                              • REVIEWING
                            </span>
                          )}
                        </h6>
                        {/* {state.questionsData && (
                          <p className="text-sm text-gray-600 mt-1">
                            Question {state.currentQuestionStep + 1} of{" "}
                            {state.questions?.length || 0} •{" "}
                            {Math.max(
                              0,
                              state.questionsData.length -
                                state.questionsLoadedCount
                            )}{" "}
                            questions remaining
                          </p>
                        )} */}
                      </div>
                    </div>
                  </div>
                </div>
                <div className="col-span-12 xl:col-span-7 flex flex-wrap gap-2 items-end justify-center md:justify-start mt-6 xl:mt-0 lg:justify-end  xl:justify-end">
                  <TooltipProvider delayDuration={100}>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Button
                          variant={"outline"}
                          disabled={state.currentQuestionStep === 0}
                          className={`group font-bold py-3 px-3 rounded-xl border-2 border-b-4 shadow-lg transform transition-all duration-200 ${
                            state.currentQuestionStep === 0
                              ? "bg-gray-300 text-gray-500 border-gray-400 cursor-not-allowed"
                              : "cursor-pointer bg-blue-500 hover:bg-blue-600 text-white border-blue-700 hover:border-blue-800 hover:shadow-xl active:translate-y-0.5 active:border-b-2"
                          }`}
                          onClick={() => {
                            if (state.currentQuestionStep > 0) {
                              playSound("button-pressed.wav");
                              dispatch({
                                type: "SET_CURRENT_QUESTION_STEP",
                                payload: state.currentQuestionStep - 1,
                              });
                            }
                          }}
                        >
                          <ArrowLeftIcon
                            className={`duration-300 ${
                              state.currentQuestionStep === 0
                                ? ""
                                : "group-hover:rotate-12"
                            }`}
                          />
                        </Button>
                      </TooltipTrigger>
                      <TooltipContent>
                        <p>Go to previous question</p>
                      </TooltipContent>
                    </Tooltip>

                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Button
                          variant={"outline"}
                          disabled={
                            !state.questions ||
                            state.currentQuestionStep >=
                              state.questions.length - 1 ||
                            !state.questionAnswers[
                              currentQuestion?.plainQuestion.questionId || ""
                            ]
                          }
                          className={`group font-bold py-3 px-3 rounded-xl border-2 border-b-4 shadow-lg transform transition-all duration-200 ${
                            !state.questions ||
                            state.currentQuestionStep >=
                              state.questions.length - 1 ||
                            !state.questionAnswers[
                              currentQuestion?.plainQuestion.questionId || ""
                            ]
                              ? "bg-gray-300 text-gray-500 border-gray-400 cursor-not-allowed"
                              : "cursor-pointer bg-blue-500 hover:bg-blue-600 text-white border-blue-700 hover:border-blue-800 hover:shadow-xl active:translate-y-0.5 active:border-b-2"
                          }`}
                          onClick={() => {
                            if (
                              state.questions &&
                              state.currentQuestionStep <
                                state.questions.length - 1 &&
                              state.questionAnswers[
                                currentQuestion?.plainQuestion.questionId || ""
                              ]
                            ) {
                              playSound("button-pressed.wav");
                              dispatch({
                                type: "SET_CURRENT_QUESTION_STEP",
                                payload: state.currentQuestionStep + 1,
                              });
                            }
                          }}
                        >
                          <ArrowRightIcon
                            className={`duration-300 ${
                              !state.questions ||
                              state.currentQuestionStep >=
                                state.questions.length - 1 ||
                              !state.questionAnswers[
                                currentQuestion?.plainQuestion.questionId || ""
                              ]
                                ? ""
                                : "group-hover:-rotate-12"
                            }`}
                          />
                        </Button>
                      </TooltipTrigger>
                      <TooltipContent>
                        <p>
                          Go to next question{" "}
                          {!state.questionAnswers[
                            currentQuestion?.plainQuestion.questionId || ""
                          ]
                            ? "(answer current question first)"
                            : ""}
                        </p>
                      </TooltipContent>
                    </Tooltip>

                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Button
                          variant={"outline"}
                          className="cursor-pointer group bg-white hover:bg-gray-50 text-gray-700 font-bold py-3 px-6 rounded-2xl border-2 border-b-4 border-gray-300 hover:border-gray-400 shadow-md hover:shadow-lg transform transition-all duration-200 active:translate-y-0.5 active:border-b-2"
                          onClick={() => {
                            dispatch({ type: "TOGGLE_REFERENCE_POPUP" });
                            playSound("button-pressed.wav");
                          }}
                        >
                          <PyramidIcon className="group-hover:rotate-12 duration-300 mr-2" />
                          Reference
                        </Button>
                      </TooltipTrigger>
                      <TooltipContent>
                        <p>Open reference sheet</p>
                      </TooltipContent>
                    </Tooltip>

                    {Object.keys(state.questionAnswers).length > 0 &&
                      !effectiveReviewMode && (
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <Button
                              variant="default"
                              className="cursor-pointer bg-green-500 hover:bg-green-600 text-white font-bold py-3 px-6 rounded-2xl border-b-4 border-green-700 hover:border-green-800 shadow-md hover:shadow-lg transform transition-all duration-200 active:translate-y-0.5 active:border-b-2"
                              onClick={handleFinish}
                            >
                              Finish Practice
                            </Button>
                          </TooltipTrigger>
                          <TooltipContent>
                            <p>Complete practice session and view results</p>
                          </TooltipContent>
                        </Tooltip>
                      )}

                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Button
                          variant="default"
                          className="justify-center items-center cursor-pointer bg-neutral-500 hover:bg-neutral-600 text-white font-bold py-3 px-6 rounded-2xl border-b-4 border-neutral-700 hover:border-neutral-800 shadow-md hover:shadow-lg transform transition-all duration-200 active:translate-y-0.5 active:border-b-2"
                          onClick={() => {
                            dispatch({ type: "TOGGLE_SHARE_MODAL" });
                            playSound("button-pressed.wav");
                          }}
                        >
                          <SendIcon className="group-hover:rotate-12 duration-300 mr-1" />
                        </Button>
                      </TooltipTrigger>
                      <TooltipContent>
                        <p>Share this practice session</p>
                      </TooltipContent>
                    </Tooltip>

                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Button
                          variant="default"
                          className="justify-center items-center cursor-pointer bg-indigo-500 hover:bg-indigo-600 text-white font-bold py-3 px-6 rounded-2xl border-b-4 border-indigo-700 hover:border-indigo-800 shadow-md hover:shadow-lg transform transition-all duration-200 active:translate-y-0.5 active:border-b-2"
                          onClick={() => {
                            const questionId =
                              currentQuestion?.plainQuestion.questionId;
                            if (questionId) {
                              const questionUrl = `${window.location.origin}/question/${questionId}`;
                              navigator.clipboard
                                .writeText(questionUrl)
                                .then(() => {
                                  toast.success("Link Copied!", {
                                    position: "top-center",
                                    description:
                                      "Question link has been copied to your clipboard.",
                                    duration: 3000,
                                  });
                                  playSound("button-pressed.wav");
                                })
                                .catch(() => {
                                  toast.error("Failed to Copy", {
                                    description:
                                      "Unable to copy link to clipboard. Please try again.",
                                    duration: 3000,
                                  });
                                });
                            }
                          }}
                        >
                          <LinkIcon className="group-hover:rotate-12 duration-300 mr-1" />
                        </Button>
                      </TooltipTrigger>
                      <TooltipContent>
                        <p>Copy link to this question</p>
                      </TooltipContent>
                    </Tooltip>

                    {currentQuestionForSave && (
                      <SaveButton
                        question={currentQuestionForSave}
                        assessment={practiceSelections.assessment}
                        isQuestionSaved={isCurrentQuestionSaved}
                        savedQuestions={savedQuestions}
                        setSavedQuestions={setSavedQuestions}
                      />
                    )}

                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Button
                          variant="default"
                          className="justify-center items-center cursor-pointer bg-gray-600 hover:bg-gray-700 text-white font-bold py-3 px-6 rounded-2xl border-b-4 border-gray-800 hover:border-gray-900 shadow-md hover:shadow-lg transform transition-all duration-200 active:translate-y-0.5 active:border-b-2"
                          onClick={() => {
                            dispatch({ type: "TOGGLE_NOTES_POPUP" });
                            playSound("button-pressed.wav");
                          }}
                        >
                          {(() => {
                            try {
                              const assessmentNotes =
                                questionNotes[practiceSelections.assessment] ||
                                [];
                              const hasNote = assessmentNotes.some(
                                (note: QuestionNote) =>
                                  note.questionId ===
                                  currentQuestion?.plainQuestion.questionId
                              );

                              return (
                                <NotebookPen
                                  className={`group-hover:rotate-12 duration-300 mr-2`}
                                />
                              );
                            } catch {
                              return (
                                <NotebookPen className="group-hover:rotate-12 duration-300 mr-2" />
                              );
                            }
                          })()}
                        </Button>
                      </TooltipTrigger>
                      <TooltipContent>
                        <p>
                          {(() => {
                            try {
                              const assessmentNotes =
                                questionNotes[practiceSelections.assessment] ||
                                [];
                              const hasNote = assessmentNotes.some(
                                (note: QuestionNote) =>
                                  note.questionId ===
                                  currentQuestion?.plainQuestion.questionId
                              );

                              return hasNote
                                ? "Edit personal note for this question"
                                : "Add personal note to this question";
                            } catch {
                              return "Add personal note to this question";
                            }
                          })()}
                        </p>
                      </TooltipContent>
                    </Tooltip>
                  </TooltipProvider>

                  {/* <Button
                    variant="destructive"
                    className="cursor-pointer bg-red-500 hover:bg-red-600 text-white font-bold py-3 px-6 rounded-2xl border-b-4 border-red-700 hover:border-red-800 shadow-md hover:shadow-lg transform transition-all duration-200 active:translate-y-0.5 active:border-b-2"
                    onClick={handleExit}
                  >
                    Exit
                  </Button> */}
                </div>
              </div>

              <div className="w-full grid grid-cols-4 lg:grid-cols-8 items-center justify-center gap-8 h-full">
                <div
                  className={`col-span-4 ${
                    practiceSelections?.subject === "reading-writing"
                      ? "lg:col-span-5"
                      : "lg:col-span-3"
                  }  flex flex-col gap-6 h-full relative`}
                >
                  <React.Fragment>
                    {currentQuestion.stimulus && (
                      <MathJax
                        inline
                        dynamic
                        id="stimulus"
                        className="text-xl text-justify answer-option"
                      >
                        <span
                          dangerouslySetInnerHTML={{
                            __html: currentQuestion.stimulus
                              ? currentQuestion.stimulus
                              : "",
                          }}
                        ></span>
                      </MathJax>
                    )}

                    {practiceSelections?.subject !== "reading-writing" &&
                      currentQuestion.stem && (
                        <MathJax inline dynamic>
                          <span
                            id="question_stem"
                            className="text-xl answer-option"
                            dangerouslySetInnerHTML={{
                              __html: currentQuestion.stem,
                            }}
                          ></span>
                        </MathJax>
                      )}

                    {practiceSelections?.subject !== "reading-writing" &&
                      (currentQuestion.answerOptions ? (
                        <AnswerOptions
                          answerOptions={currentQuestion.answerOptions}
                          questionId={currentQuestion.plainQuestion.questionId}
                          selectedAnswer={state.selectedAnswer}
                          disabledOptions={state.disabledOptions}
                          onAnswerSelect={(key) =>
                            dispatch({
                              type: "SET_SELECTED_ANSWER",
                              payload: key,
                            })
                          }
                          onToggleDisabled={(key) => {
                            dispatch({
                              type: "SET_DISABLED_OPTION",
                              payload: {
                                key,
                                value: !state.disabledOptions[key],
                              },
                            });
                          }}
                          showStrikethrough={true}
                          correctAnswers={currentQuestion.correct_answer.map(
                            (answer) => answer.trim()
                          )}
                          isAnswerChecked={state.isAnswerChecked}
                          isReviewMode={
                            isReviewMode ||
                            Boolean(
                              state.questionAnswers[
                                currentQuestion.plainQuestion.questionId
                              ]
                            )
                          }
                        />
                      ) : (
                        <DuolingoInput
                          value={state.selectedAnswer || ""}
                          onChange={(value) =>
                            dispatch({
                              type: "SET_SELECTED_ANSWER",
                              payload: value,
                            })
                          }
                          onSubmit={handleAnsweringQuestion(
                            currentQuestion.plainQuestion.questionId
                          )}
                          disabled={state.isAnswerChecked || isReviewMode}
                        />
                      ))}
                    <div className="pt-1 pb-2 relative overflow-visible">
                      {/* Show Load More and Finish buttons when at end of loaded questions and answer is checked */}
                      {practiceSelections?.subject !== "reading-writing" &&
                        (isAtEndOfBatch &&
                        state.isAnswerChecked &&
                        state.questionAnswers[
                          currentQuestion.plainQuestion.questionId
                        ] ? (
                          <div className="flex gap-3 mt-5">
                            {canLoadMore && (
                              <Button
                                variant="default"
                                className={`flex-1 font-bold text-lg py-6 border-b-4 rounded-2xl text-white shadow-lg transform transition-all duration-200 ${
                                  state.isLoadingNextBatch
                                    ? "bg-blue-400 border-blue-500 cursor-not-allowed"
                                    : "bg-blue-500 hover:bg-blue-600 border-blue-700 hover:border-blue-800 cursor-pointer hover:shadow-xl active:translate-y-0.5 active:border-b-2"
                                }`}
                                onClick={() =>
                                  !state.isLoadingNextBatch && loadNextBatch()
                                }
                                disabled={state.isLoadingNextBatch}
                              >
                                {state.isLoadingNextBatch ? (
                                  <span className="flex items-center justify-center gap-2">
                                    <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                                    LOADING... ({state.questionsProcessedCount}
                                    /22)
                                  </span>
                                ) : (
                                  "LOAD MORE"
                                )}
                              </Button>
                            )}
                            <Button
                              variant="default"
                              className="flex-1 font-bold text-lg py-6 border-b-4 rounded-2xl text-white shadow-lg transform transition-all duration-200 bg-green-500 hover:bg-green-600 border-green-700 hover:border-green-800 cursor-pointer hover:shadow-xl active:translate-y-0.5 active:border-b-2"
                              onClick={handleFinish}
                            >
                              FINISH
                            </Button>
                          </div>
                        ) : (
                          <Button
                            variant={"default"}
                            className={`mt-5 w-full relative font-bold text-lg py-6 border-b-4 rounded-2xl text-white shadow-lg transform transition-all duration-200 ${
                              state.isLoadingNextBatch
                                ? "bg-yellow-500 hover:bg-yellow-600 border-yellow-700 hover:border-yellow-800 cursor-wait animate-pulse"
                                : state.isAnswerChecked && state.isAnswerCorrect
                                ? "bg-green-500 hover:bg-green-600 border-green-700 hover:border-green-800 cursor-pointer hover:shadow-xl active:translate-y-0.5 active:border-b-2"
                                : state.isAnswerChecked &&
                                  !state.isAnswerCorrect
                                ? "bg-red-500 hover:bg-red-600 border-red-700 hover:border-red-800 cursor-pointer hover:shadow-xl active:translate-y-0.5 active:border-b-2"
                                : "bg-blue-500 hover:bg-blue-600 border-blue-700 hover:border-blue-800 cursor-pointer hover:shadow-xl active:translate-y-0.5 active:border-b-2"
                            }`}
                            disabled={
                              (state.selectedAnswer == null &&
                                !state.questionAnswers[
                                  currentQuestion.plainQuestion.questionId
                                ]) ||
                              state.isLoadingNextBatch
                            }
                            onClick={handleAnsweringQuestion(
                              currentQuestion.plainQuestion.questionId
                            )}
                          >
                            {state.isLoadingNextBatch ? (
                              <DuolingoLoadingSpinner
                                progress={state.questionsProcessedCount}
                                total={22}
                              />
                            ) : state.questionAnswers[
                                currentQuestion.plainQuestion.questionId
                              ] ? (
                              "NEXT"
                            ) : !state.isAnswerChecked ? (
                              "CHECK"
                            ) : (
                              "CONTINUE"
                            )}
                          </Button>
                        ))}
                      <Confetti
                        ref={confettiRef}
                        className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 z-10 w-full h-full pointer-events-none"
                      />
                    </div>
                    {/* <Button
                      variant={"ghost"}
                      className="text-md cursor-pointer"
                      disabled={!state.isAnswerChecked}
                    >
                      EXPLAIN
                    </Button> */}

                    {state.isAnswerChecked && state.selectedAnswer && (
                      <React.Fragment>
                        {/* Show review indicator when viewing previous question */}
                        {state.questionAnswers[
                          currentQuestion.plainQuestion.questionId
                        ] && (
                          <div className="bg-orange-50 border border-orange-200 rounded-lg p-4 mb-4">
                            <div className="flex items-center gap-2 mb-2">
                              <div className="w-3 h-3 bg-orange-500 rounded-full"></div>
                              <span className="text-orange-700 font-semibold">
                                Question Review
                              </span>
                            </div>
                            <p className="text-orange-600 text-sm">
                              You are reviewing a previously answered question.
                              Your original answer and the explanation are shown
                              below.
                              <br /> <br />
                              Please scroll down to bottom to see explanation,{" "}
                              {
                                "we've moved it to the bottom for better visibility."
                              }
                            </p>
                          </div>
                        )}

                        <Label className="text-lg font-semibold">
                          Your Answer:{" "}
                          <span
                            className={`${
                              state.isAnswerCorrect
                                ? "text-green-600"
                                : "text-red-600"
                            }`}
                          >
                            {state.selectedAnswer}
                          </span>
                          {state.isAnswerCorrect ? (
                            <span className="ml-2 text-green-600 text-sm">
                              ✓ Correct
                            </span>
                          ) : (
                            <span className="ml-2 text-red-600 text-sm">
                              ✗ Incorrect
                            </span>
                          )}
                        </Label>
                        <Label className="text-lg font-semibold">
                          Correct Answer:{" "}
                          <span className={"text-green-600"}>
                            {currentQuestion.correct_answer.join(", ")}
                          </span>
                        </Label>
                      </React.Fragment>
                    )}
                  </React.Fragment>
                </div>

                <div
                  className={`col-span-4 ${
                    practiceSelections?.subject === "reading-writing"
                      ? "lg:col-span-3"
                      : "lg:col-span-5"
                  } h-full `}
                >
                  {practiceSelections?.subject !== "reading-writing" ? (
                    <div className="border-2 border-gray-200 shadow-lg overflow-hidden rounded-lg">
                      <iframe
                        src="https://www.desmos.com/testing/cb-sat-ap/graphing"
                        width={"100%"}
                        className="h-[800px]"
                      ></iframe>
                    </div>
                  ) : (
                    <React.Fragment>
                      <MathJax inline dynamic className="text-xl">
                        <span
                          dangerouslySetInnerHTML={{
                            __html: currentQuestion.stem,
                          }}
                        ></span>
                      </MathJax>
                      <Separator className="my-4" />
                      {currentQuestion.answerOptions ? (
                        <AnswerOptions
                          answerOptions={currentQuestion.answerOptions}
                          questionId={currentQuestion.plainQuestion.questionId}
                          selectedAnswer={state.selectedAnswer}
                          disabledOptions={state.disabledOptions}
                          onAnswerSelect={(key) =>
                            dispatch({
                              type: "SET_SELECTED_ANSWER",
                              payload: key,
                            })
                          }
                          onToggleDisabled={(key) => {
                            dispatch({
                              type: "SET_DISABLED_OPTION",
                              payload: {
                                key,
                                value: !state.disabledOptions[key],
                              },
                            });
                          }}
                          showStrikethrough={true}
                          correctAnswers={currentQuestion.correct_answer.map(
                            (answer) => answer.trim()
                          )}
                          isAnswerChecked={state.isAnswerChecked}
                          isReviewMode={
                            isReviewMode ||
                            Boolean(
                              state.questionAnswers[
                                currentQuestion.plainQuestion.questionId
                              ]
                            )
                          }
                        />
                      ) : (
                        <DuolingoInput
                          value={state.selectedAnswer || ""}
                          onChange={(value) =>
                            dispatch({
                              type: "SET_SELECTED_ANSWER",
                              payload: value,
                            })
                          }
                          onSubmit={handleAnsweringQuestion(
                            currentQuestion.plainQuestion.questionId
                          )}
                          disabled={state.isAnswerChecked || isReviewMode}
                        />
                      )}
                      <div className="py-1 relative overflow-visible">
                        {practiceSelections?.subject == "reading-writing" &&
                          (isAtEndOfBatch &&
                          state.isAnswerChecked &&
                          state.questionAnswers[
                            currentQuestion.plainQuestion.questionId
                          ] ? (
                            <div className="flex gap-3 mt-5">
                              {canLoadMore && (
                                <Button
                                  variant="default"
                                  className={`flex-1 font-bold text-lg py-6 border-b-4 rounded-2xl text-white shadow-lg transform transition-all duration-200 ${
                                    state.isLoadingNextBatch
                                      ? "bg-blue-400 border-blue-500 cursor-not-allowed"
                                      : "bg-blue-500 hover:bg-blue-600 border-blue-700 hover:border-blue-800 cursor-pointer hover:shadow-xl active:translate-y-0.5 active:border-b-2"
                                  }`}
                                  onClick={() =>
                                    !state.isLoadingNextBatch && loadNextBatch()
                                  }
                                  disabled={state.isLoadingNextBatch}
                                >
                                  {state.isLoadingNextBatch ? (
                                    <span className="flex items-center justify-center gap-2">
                                      <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                                      LOADING... (
                                      {state.questionsProcessedCount}
                                      /22)
                                    </span>
                                  ) : (
                                    "LOAD MORE"
                                  )}
                                </Button>
                              )}
                              <Button
                                variant="default"
                                className="flex-1 font-bold text-lg py-6 border-b-4 rounded-2xl text-white shadow-lg transform transition-all duration-200 bg-green-500 hover:bg-green-600 border-green-700 hover:border-green-800 cursor-pointer hover:shadow-xl active:translate-y-0.5 active:border-b-2"
                                onClick={handleFinish}
                              >
                                FINISH
                              </Button>
                            </div>
                          ) : (
                            <Button
                              variant={"default"}
                              className={`mt-5 w-full relative font-bold text-lg py-6 border-b-4 rounded-2xl text-white shadow-lg transform transition-all duration-200 ${
                                state.isLoadingNextBatch
                                  ? "bg-yellow-500 hover:bg-yellow-600 border-yellow-700 hover:border-yellow-800 cursor-wait animate-pulse"
                                  : state.isAnswerChecked &&
                                    state.isAnswerCorrect
                                  ? "bg-green-500 hover:bg-green-600 border-green-700 hover:border-green-800 cursor-pointer hover:shadow-xl active:translate-y-0.5 active:border-b-2"
                                  : state.isAnswerChecked &&
                                    !state.isAnswerCorrect
                                  ? "bg-red-500 hover:bg-red-600 border-red-700 hover:border-red-800 cursor-pointer hover:shadow-xl active:translate-y-0.5 active:border-b-2"
                                  : "bg-blue-500 hover:bg-blue-600 border-blue-700 hover:border-blue-800 cursor-pointer hover:shadow-xl active:translate-y-0.5 active:border-b-2"
                              }`}
                              disabled={
                                (state.selectedAnswer == null &&
                                  !state.questionAnswers[
                                    currentQuestion.plainQuestion.questionId
                                  ]) ||
                                state.isLoadingNextBatch
                              }
                              onClick={handleAnsweringQuestion(
                                currentQuestion.plainQuestion.questionId
                              )}
                            >
                              {state.isLoadingNextBatch ? (
                                <DuolingoLoadingSpinner
                                  progress={state.questionsProcessedCount}
                                  total={22}
                                />
                              ) : state.questionAnswers[
                                  currentQuestion.plainQuestion.questionId
                                ] ? (
                                "NEXT"
                              ) : !state.isAnswerChecked ? (
                                "CHECK"
                              ) : (
                                "CONTINUE"
                              )}
                            </Button>
                          ))}
                        <Confetti
                          ref={confettiRef}
                          className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 z-10 w-full h-full pointer-events-none"
                        />
                      </div>

                      {/* <Button
                        variant={"ghost"}
                        className="text-md cursor-pointer"
                        disabled={!state.isAnswerChecked}
                      >
                        Explain
                      </Button> */}
                    </React.Fragment>
                  )}
                </div>

                {state.isAnswerChecked && state.selectedAnswer && (
                  <div className="mt-4 col-span-4 lg:col-span-8">
                    <Label className="text-lg font-semibold mb-2 block">
                      Explanation:
                    </Label>
                    <MathJax
                      inline
                      dynamic
                      id="question_explanation"
                      className="text-xl text-justify"
                    >
                      <span
                        dangerouslySetInnerHTML={{
                          __html: currentQuestion.rationale,
                        }}
                      ></span>
                    </MathJax>
                  </div>
                )}
              </div>
            </div>
          </React.Fragment>
        )}
      </div>

      {/* Reference Popup */}
      <DraggableReferencePopup
        isOpen={state.isReferencePopupOpen}
        onClose={() => dispatch({ type: "TOGGLE_REFERENCE_POPUP" })}
      />

      {/* Notes Popup */}
      <DraggableNotesPopup
        isOpen={state.isNotesPopupOpen}
        onClose={() => dispatch({ type: "TOGGLE_NOTES_POPUP" })}
        questionId={currentQuestion?.plainQuestion.questionId || ""}
        assessment={practiceSelections.assessment}
        questionNotes={questionNotes}
        onSaveNote={handleSaveNote}
        currentNote={(() => {
          try {
            const assessmentNotes =
              questionNotes[practiceSelections.assessment] || [];
            const existingNote = assessmentNotes.find(
              (note: QuestionNote) =>
                note.questionId === currentQuestion?.plainQuestion.questionId
            );
            return existingNote?.note || "";
          } catch {
            return "";
          }
        })()}
      />

      {/* Success Feedback - only show for newly answered questions, not when reviewing */}
      <SuccessFeedback
        isVisible={
          state.isAnswerChecked &&
          state.isAnswerCorrect &&
          state.isTimerActive === false // Timer is stopped only when answering, not when reviewing
        }
        onContinue={() => {
          if (
            state.questions &&
            state.currentQuestionStep < state.questions.length - 1
          ) {
            dispatch({
              type: "SET_CURRENT_QUESTION_STEP",
              payload: state.currentQuestionStep + 1,
            });
          } else {
            // At end of loaded questions - don't automatically continue
            console.log(
              "Reached end of loaded questions in success feedback. User can choose to continue or finish."
            );
          }
        }}
      />

      {/* Exit Confirmation */}
      <ExitConfirmation
        isVisible={state.isExitConfirmationOpen}
        onConfirm={confirmExit}
        onCancel={() => dispatch({ type: "TOGGLE_EXIT_CONFIRMATION" })}
      />

      {/* Finish Confirmation */}
      <FinishConfirmation
        isVisible={state.isFinishConfirmationOpen}
        onConfirm={confirmFinish}
        onCancel={() => dispatch({ type: "TOGGLE_FINISH_CONFIRMATION" })}
        questionsAnswered={
          Object.keys(state.questionAnswers).filter(
            (id) => state.questionAnswers[id] !== null
          ).length
        }
      />

      {/* Share Modal */}
      <ShareModal
        isVisible={state.isShareModalOpen}
        onClose={() => dispatch({ type: "TOGGLE_SHARE_MODAL" })}
        practiceSelections={practiceSelections}
        questions={state.questions}
      />
    </React.Fragment>
  );
}
