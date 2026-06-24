import { useState, useMemo } from "react";
import { motion, AnimatePresence } from "motion/react";
import { ChevronLeft, Check, ArrowRight, X } from "lucide-react";
import { ImageWithFallback } from "./figma/ImageWithFallback";
import { translations, Language } from "../../lib/translations";

interface ProductWizardProps {
  item: any;
  lang: Language;
  onClose: () => void;
  onAddToCart: (customizations: Record<string, any>, finalPrice: number) => void;
}

export function ProductWizard({ item, lang, onClose, onAddToCart }: ProductWizardProps) {
  const t = translations[lang];
  
  // Customizations state
  const [customizations, setCustomizations] = useState<Record<string, any>>({});
  
  // Menu Upsell state
  const [isMenu, setIsMenu] = useState<boolean | null>(null);

  // Compute steps
  const steps = useMemo(() => {
    const computedSteps: any[] = [];
    
    // Step 1: Upsell Menu (only for Burgers)
    if (item.category === "Burgers") {
      computedSteps.push({ id: "upsell-menu", type: "upsell" });
    }

    // Step 2: Existing Custom Fields
    const fields = Array.isArray(item.customFields) ? item.customFields : 
                   Array.isArray(item.custom_fields) ? item.custom_fields : [];
    
    fields.forEach((field: any) => {
      computedSteps.push({ id: field.id, type: "field", field });
    });

    // Step 3: Dynamic Menu Fields (if they chose Menu)
    if (item.category === "Burgers" && isMenu === true) {
      computedSteps.push({
        id: "menu-side",
        type: "field",
        field: {
          id: "menu-side",
          name: lang === "fr" ? "Choisissez votre accompagnement" : "Choose your side",
          type: "radio",
          required: true,
          options: ["Frites Classiques", "Frites Truffe (+€2.00)", "Potatoes"]
        }
      });
      computedSteps.push({
        id: "menu-drink",
        type: "field",
        field: {
          id: "menu-drink",
          name: lang === "fr" ? "Choisissez votre boisson" : "Choose your drink",
          type: "radio",
          required: true,
          options: ["Coca-Cola", "Coca-Cola Zéro", "Ice Tea", "Eau Plate", "Eau Gazeuse"]
        }
      });
    }

    // Final Step: Summary
    computedSteps.push({ id: "summary", type: "summary" });

    return computedSteps;
  }, [item, isMenu, lang]);

  const [currentStepIndex, setCurrentStepIndex] = useState(0);
  const [direction, setDirection] = useState(1);

  const currentStep = steps[currentStepIndex];

  const goNext = () => {
    if (currentStepIndex < steps.length - 1) {
      setDirection(1);
      setCurrentStepIndex(prev => prev + 1);
    }
  };

  const goBack = () => {
    if (currentStepIndex > 0) {
      setDirection(-1);
      setCurrentStepIndex(prev => prev - 1);
    } else {
      onClose();
    }
  };

  const skipStep = () => {
    goNext();
  };

  const parsePriceModifier = (optionText: string): number => {
    if (!optionText) return 0;
    const match = optionText.match(/\+\s*€?\s*([0-9.,]+)/);
    if (match && match[1]) {
      return parseFloat(match[1].replace(',', '.'));
    }
    return 0;
  };

  const calculateTotal = () => {
    let total = item.price;
    if (isMenu) total += 4.0; // Base Menu Price increase
    
    // Add custom fields pricing
    Object.keys(customizations).forEach(key => {
      const val = customizations[key];
      if (Array.isArray(val)) {
        val.forEach(v => total += parsePriceModifier(v));
      } else if (typeof val === 'string') {
        total += parsePriceModifier(val);
      }
    });
    return total;
  };

  const handleFinish = () => {
    // Inject menu selections into customizations if applicable
    const finalCustomizations = { ...customizations };
    if (isMenu) {
      finalCustomizations["Formule Menu"] = "Oui (+€4.00)";
    }
    onAddToCart(finalCustomizations, calculateTotal());
  };

  const canProceed = () => {
    if (currentStep.type === "upsell") {
      return isMenu !== null;
    }
    if (currentStep.type === "field" && currentStep.field.required) {
      const val = customizations[currentStep.field.id];
      if (currentStep.field.type === "checkbox") {
        return Array.isArray(val) && val.length > 0;
      }
      return !!val;
    }
    return true;
  };

  // Animation variants
  const variants = {
    enter: (direction: number) => ({
      x: direction > 0 ? 300 : -300,
      opacity: 0
    }),
    center: {
      zIndex: 1,
      x: 0,
      opacity: 1
    },
    exit: (direction: number) => ({
      zIndex: 0,
      x: direction < 0 ? 300 : -300,
      opacity: 0
    })
  };

  return (
    <>
      <motion.div
        initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
        onClick={onClose}
        className="fixed inset-0 bg-black/80 backdrop-blur-[2px] z-40"
      />
      <motion.div
        initial={{ y: "100%" }} animate={{ y: 0 }} exit={{ y: "100%" }}
        transition={{ type: "spring", damping: 25, stiffness: 220 }}
        className="fixed inset-0 sm:inset-auto sm:bottom-0 sm:left-1/2 sm:-translate-x-1/2 sm:w-full sm:max-w-md sm:h-[85vh] bg-background border-border border rounded-t-2xl sm:rounded-2xl sm:mb-4 z-50 flex flex-col overflow-hidden shadow-2xl"
      >
        {/* Header */}
        <div className="px-4 py-3 flex items-center justify-between border-b border-border/30 bg-card relative z-10">
          <button onClick={goBack} className="p-2 -ml-2 rounded-full hover:bg-secondary transition-colors text-foreground">
            <ChevronLeft size={20} />
          </button>
          
          {/* Progress Dots */}
          <div className="flex gap-1.5">
            {steps.map((_, idx) => (
              <div key={idx} className={`h-1.5 rounded-full transition-all duration-300 ${idx === currentStepIndex ? 'w-4 bg-primary' : idx < currentStepIndex ? 'w-1.5 bg-primary/50' : 'w-1.5 bg-border'}`} />
            ))}
          </div>

          <button onClick={onClose} className="p-2 -mr-2 rounded-full hover:bg-secondary transition-colors text-foreground">
            <X size={20} />
          </button>
        </div>

        {/* Dynamic Content */}
        <div className="flex-1 overflow-hidden relative bg-background">
          <AnimatePresence initial={false} custom={direction} mode="wait">
            <motion.div
              key={currentStepIndex}
              custom={direction}
              variants={variants}
              initial="enter"
              animate="center"
              exit="exit"
              transition={{ x: { type: "spring", stiffness: 300, damping: 30 }, opacity: { duration: 0.2 } }}
              className="absolute inset-0 overflow-y-auto pb-24 px-5 pt-6"
            >
              
              {/* Step: Upsell Menu */}
              {currentStep.type === "upsell" && (
                <div className="flex flex-col h-full">
                  <div className="text-center mb-8">
                    <h2 className="font-serif font-bold text-2xl text-foreground mb-2">
                      {lang === "fr" ? "Faites-en un Menu ?" : "Make it a Menu?"}
                    </h2>
                    <p className="text-muted-foreground text-sm">
                      {lang === "fr" ? "Ajoutez des frites et une boisson pour seulement +4.00€" : "Add fries and a drink for only +€4.00"}
                    </p>
                  </div>
                  
                  <div className="flex flex-col gap-4">
                    <button
                      onClick={() => { setIsMenu(true); setTimeout(goNext, 150); }}
                      className={`p-5 rounded-2xl border-2 transition-all text-left flex items-center justify-between group ${isMenu === true ? 'border-primary bg-primary/5' : 'border-border bg-card hover:border-primary/50'}`}
                    >
                      <div>
                        <span className="block font-bold text-lg text-foreground mb-1">
                          {lang === "fr" ? "Oui, faire un Menu" : "Yes, make it a Menu"}
                        </span>
                        <span className="text-sm text-primary font-bold">+€4.00</span>
                      </div>
                      <div className={`w-6 h-6 rounded-full border-2 flex items-center justify-center ${isMenu === true ? 'border-primary bg-primary' : 'border-muted-foreground group-hover:border-primary/50'}`}>
                        {isMenu === true && <Check size={14} className="text-primary-foreground stroke-[3px]" />}
                      </div>
                    </button>

                    <button
                      onClick={() => { setIsMenu(false); setTimeout(goNext, 150); }}
                      className={`p-5 rounded-2xl border-2 transition-all text-left flex items-center justify-between group ${isMenu === false ? 'border-primary bg-primary/5' : 'border-border bg-card hover:border-primary/50'}`}
                    >
                      <div>
                        <span className="block font-bold text-lg text-foreground mb-1">
                          {lang === "fr" ? "Non, juste le burger" : "No, just the burger"}
                        </span>
                        <span className="text-sm text-muted-foreground">
                          {lang === "fr" ? "Continuer sans menu" : "Continue without menu"}
                        </span>
                      </div>
                      <div className={`w-6 h-6 rounded-full border-2 flex items-center justify-center ${isMenu === false ? 'border-primary bg-primary' : 'border-muted-foreground group-hover:border-primary/50'}`}>
                        {isMenu === false && <Check size={14} className="text-primary-foreground stroke-[3px]" />}
                      </div>
                    </button>
                  </div>
                </div>
              )}

              {/* Step: Custom Field */}
              {currentStep.type === "field" && (
                <div className="flex flex-col h-full">
                  <h2 className="font-serif font-bold text-2xl text-foreground mb-6">
                    {currentStep.field.name}
                  </h2>
                  
                  {currentStep.field.type === "radio" && (
                    <div className="flex flex-col gap-3">
                      {currentStep.field.options.map((opt: string) => {
                        const selected = customizations[currentStep.field.id] === opt;
                        return (
                          <button
                            key={opt}
                            onClick={() => {
                              setCustomizations(p => ({ ...p, [currentStep.field.id]: opt }));
                              setTimeout(goNext, 200);
                            }}
                            className={`p-4 rounded-xl border-2 transition-all text-left flex items-center justify-between group ${selected ? 'border-primary bg-primary/5' : 'border-border bg-card hover:border-primary/50'}`}
                          >
                            <span className="font-bold text-foreground">{opt}</span>
                            <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center ${selected ? 'border-primary bg-primary' : 'border-muted-foreground group-hover:border-primary/50'}`}>
                              {selected && <Check size={12} className="text-primary-foreground stroke-[3px]" />}
                            </div>
                          </button>
                        );
                      })}
                    </div>
                  )}

                  {currentStep.field.type === "checkbox" && (
                    <div className="flex flex-col gap-3">
                      {currentStep.field.options.map((opt: string) => {
                        const arr = (customizations[currentStep.field.id] as string[] | undefined) || [];
                        const checked = arr.includes(opt);
                        return (
                          <button
                            key={opt}
                            onClick={() => {
                              setCustomizations(p => {
                                const prev = (p[currentStep.field.id] as string[] | undefined) || [];
                                return { ...p, [currentStep.field.id]: checked ? prev.filter(x => x !== opt) : [...prev, opt] };
                              });
                            }}
                            className={`p-4 rounded-xl border-2 transition-all text-left flex items-center justify-between group ${checked ? 'border-primary bg-primary/5' : 'border-border bg-card hover:border-primary/50'}`}
                          >
                            <span className="font-bold text-foreground">{opt}</span>
                            <div className={`w-5 h-5 rounded-md border-2 flex items-center justify-center ${checked ? 'border-primary bg-primary' : 'border-muted-foreground group-hover:border-primary/50'}`}>
                              {checked && <Check size={12} className="text-primary-foreground stroke-[3px]" />}
                            </div>
                          </button>
                        );
                      })}
                    </div>
                  )}
                </div>
              )}

              {/* Step: Summary */}
              {currentStep.type === "summary" && (
                <div className="flex flex-col h-full items-center text-center">
                  <div className="w-32 h-32 rounded-2xl overflow-hidden bg-secondary border border-border mb-6">
                    <ImageWithFallback src={item.image} alt={item.name} className="w-full h-full object-cover" />
                  </div>
                  <h2 className="font-serif font-bold text-2xl text-foreground mb-2">
                    {lang === "fr" ? "Récapitulatif" : "Summary"}
                  </h2>
                  <p className="font-mono font-bold text-xl text-primary mb-6">€{calculateTotal().toFixed(2)}</p>

                  <div className="w-full bg-card rounded-xl border border-border p-4 text-left">
                    <h3 className="font-bold text-foreground mb-3 border-b border-border pb-2">{item.name}</h3>
                    {isMenu && (
                      <div className="flex justify-between text-sm mb-2">
                        <span className="text-muted-foreground">Menu</span>
                        <span className="font-mono text-foreground">+€4.00</span>
                      </div>
                    )}
                    {Object.entries(customizations).map(([key, val]) => {
                      if (!val || (Array.isArray(val) && val.length === 0)) return null;
                      
                      const fieldName = steps.find(s => s.field?.id === key)?.field?.name || key;

                      return (
                        <div key={key} className="mb-2 last:mb-0">
                          <span className="text-xs text-muted-foreground uppercase tracking-wider">{fieldName}</span>
                          {Array.isArray(val) ? (
                            val.map(v => (
                              <div key={v} className="text-sm font-medium text-foreground ml-2">• {v}</div>
                            ))
                          ) : (
                            <div className="text-sm font-medium text-foreground ml-2">• {val}</div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </motion.div>
          </AnimatePresence>
        </div>

        {/* Footer Navigation */}
        <div className="absolute bottom-0 left-0 right-0 p-4 border-t border-border bg-card z-20 flex gap-3">
          {currentStep.type !== "summary" && !currentStep.field?.required && currentStep.type !== "upsell" && (
            <button 
              onClick={skipStep}
              className="px-6 py-4 text-sm font-bold text-muted-foreground bg-secondary hover:bg-secondary/80 rounded-xl transition-colors"
            >
              {lang === "fr" ? "Passer" : "Skip"}
            </button>
          )}

          {currentStep.type === "summary" ? (
             <button 
              onClick={handleFinish}
              className="flex-1 py-4 text-sm font-black tracking-widest bg-primary text-primary-foreground rounded-xl hover:opacity-90 active:scale-[0.98] transition-all cursor-pointer shadow-lg shadow-primary/20 flex items-center justify-center gap-2"
            >
              {t.addToCart.toUpperCase()} — €{calculateTotal().toFixed(2)}
            </button>
          ) : (
            <button 
              onClick={goNext}
              disabled={!canProceed()}
              className="flex-1 py-4 text-sm font-black tracking-widest bg-foreground text-background rounded-xl hover:opacity-90 active:scale-[0.98] transition-all cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
            >
              {lang === "fr" ? "SUIVANT" : "NEXT"} <ArrowRight size={16} />
            </button>
          )}
        </div>
      </motion.div>
    </>
  );
}
