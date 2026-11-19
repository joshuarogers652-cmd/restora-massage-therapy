-- RESTORA reference data: services, durations, enhancements, screening, rules, consent forms,
-- SOAP templates and default settings. Generated once from the Phase 1 content; edit through
-- the admin dashboard afterwards. Prices are from the owner's business plan and are editable.
-- Screening categories are conservative defaults that MUST be reviewed by a qualified professional.

INSERT INTO screening_items (code, label_en, label_es, sort_order) VALUES
  ('fever', $q$Fever$q$, $q$Fiebre$q$, 1),
  ('contagious_illness', $q$Cold, flu or other contagious illness$q$, $q$Resfriado, gripe u otra enfermedad contagiosa$q$, 2),
  ('suspected_blood_clot', $q$Suspected blood clot (for example, a swollen, warm, painful calf)$q$, $q$Sospecha de coágulo sanguíneo (por ejemplo, pantorrilla hinchada, caliente o dolorosa)$q$, 3),
  ('unexplained_severe_pain', $q$Severe pain with no known cause$q$, $q$Dolor intenso sin causa conocida$q$, 4),
  ('open_wounds', $q$Open wounds, cuts or burns$q$, $q$Heridas abiertas, cortes o quemaduras$q$, 5),
  ('skin_infection', $q$Skin infection or rash$q$, $q$Infección o erupción en la piel$q$, 6),
  ('recent_surgery', $q$Surgery in the past 6 months$q$, $q$Cirugía en los últimos 6 meses$q$, 7),
  ('acute_injury', $q$Recent injury, sprain or strain$q$, $q$Lesión, esguince o distensión reciente$q$, 8),
  ('bleeding_disorder', $q$Bleeding or clotting disorder$q$, $q$Trastorno de sangrado o de coagulación$q$, 9),
  ('anticoagulants', $q$Taking blood thinners$q$, $q$Toma anticoagulantes$q$, 10),
  ('reduced_sensation', $q$Reduced sensation or numbness (for example, from diabetes)$q$, $q$Sensibilidad reducida o adormecimiento (por ejemplo, por diabetes)$q$, 11),
  ('circulatory_concerns', $q$Heart or circulation conditions, including varicose veins$q$, $q$Afecciones del corazón o de la circulación, incluidas várices$q$, 12),
  ('allergies', $q$Allergies or sensitivities to lotions, nuts or fragrances$q$, $q$Alergias o sensibilidad a lociones, frutos secos o fragancias$q$, 13),
  ('pregnancy', $q$Currently pregnant$q$, $q$Embarazo actual$q$, 14),
  ('scent_sensitivity', $q$Asthma, migraines or sensitivity triggered by scents$q$, $q$Asma, migrañas o sensibilidad provocada por aromas$q$, 15),
  ('essential_oil_allergy', $q$Allergy to essential oils or plants$q$, $q$Alergia a aceites esenciales o a plantas$q$, 16),
  ('pregnancy_warning_signs', $q$Vaginal bleeding, sudden swelling, severe headache, vision changes or abdominal pain$q$, $q$Sangrado vaginal, hinchazón repentina, dolor de cabeza intenso, cambios en la visión o dolor abdominal$q$, 17),
  ('high_risk_pregnancy', $q$High-risk pregnancy or pregnancy complications$q$, $q$Embarazo de alto riesgo o complicaciones del embarazo$q$, 18),
  ('recent_cosmetic_procedure', $q$Recent cosmetic procedure (fillers, injections, peels, laser)$q$, $q$Procedimiento estético reciente (rellenos, inyecciones, peelings, láser)$q$, 19),
  ('facial_inflammation', $q$Significant facial inflammation or swelling$q$, $q$Inflamación o hinchazón facial importante$q$, 20),
  ('other_facial_condition', $q$Other facial or jaw conditions$q$, $q$Otras afecciones del rostro o de la mandíbula$q$, 21),
  ('foot_irritation', $q$Significant irritation on the feet$q$, $q$Irritación importante en los pies$q$, 22),
  ('fragile_skin', $q$Fragile, thin or damaged skin$q$, $q$Piel frágil, delgada o dañada$q$, 23),
  ('other_clinical_precaution', $q$Other conditions your provider has asked you to be careful with$q$, $q$Otras afecciones con las que su médico le ha pedido tener cuidado$q$, 24);

INSERT INTO services (slug, name_en, name_es, summary_en, summary_es, description_en, description_es, expect_en, expect_es, benefits_en, benefits_es, candidates_en, candidates_es, notes_en, notes_es, pressure_options, requires_consents, sort_order) VALUES (
  'swedish', $q$Swedish Massage$q$, $q$Masaje sueco$q$, $q$Flowing strokes and pressure adjusted to you, to ease everyday muscle tension and help you relax.$q$, $q$Movimientos fluidos y presión ajustada a usted, para aliviar la tensión muscular cotidiana y ayudarle a relajarse.$q$, $q$A relaxing massage using flowing strokes and individually adjusted pressure to help reduce everyday muscle tension and encourage relaxation. It is a good choice for a first massage or a regular reset.$q$, $q$Un masaje relajante con movimientos fluidos y presión ajustada a cada persona, que ayuda a reducir la tensión muscular cotidiana y favorece la relajación. Es una buena opción para un primer masaje o para un descanso habitual.$q$,
  $q$["A short conversation about your goals and any areas to focus on or avoid.","Long gliding strokes, kneading and gentle circular movements.","You stay covered with a sheet. Only the area being massaged is uncovered.","Your therapist checks in about pressure, and you can ask for changes at any time."]$q$::jsonb, $q$["Una breve conversación sobre sus objetivos y las zonas en las que enfocarse o evitar.","Movimientos largos y deslizantes, amasamiento y movimientos circulares suaves.","Permanece cubierto con una sábana. Solo se descubre la zona que se está masajeando.","Su terapeuta le pregunta por la presión, y usted puede pedir cambios en cualquier momento."]$q$::jsonb,
  $q$["May help you feel more relaxed","May ease everyday muscle tension","A calm break from daily stress"]$q$::jsonb, $q$["Puede ayudarle a sentirse más relajado","Puede aliviar la tensión muscular cotidiana","Un momento de calma lejos del estrés diario"]$q$::jsonb,
  $q$["First-time massage clients","Anyone looking to relax and unwind","People with general, everyday muscle tension"]$q$::jsonb, $q$["Personas que reciben su primer masaje","Quien busque relajarse y desconectar","Personas con tensión muscular general del día a día"]$q$::jsonb,
  $q$[]$q$::jsonb, $q$[]$q$::jsonb,
  ARRAY['LIGHT','MEDIUM','FIRM']::text[], ARRAY['GENERAL_TREATMENT']::text[], 1);
INSERT INTO service_durations (service_id, minutes, price_cents) SELECT id, 30, 3000 FROM services WHERE slug='swedish';
INSERT INTO service_durations (service_id, minutes, price_cents) SELECT id, 60, 5000 FROM services WHERE slug='swedish';
INSERT INTO service_durations (service_id, minutes, price_cents) SELECT id, 90, 8000 FROM services WHERE slug='swedish';
INSERT INTO service_screening (service_id, code, category) SELECT id, 'fever', 'POSTPONE_OR_REFER' FROM services WHERE slug='swedish';
INSERT INTO service_screening (service_id, code, category) SELECT id, 'contagious_illness', 'POSTPONE_OR_REFER' FROM services WHERE slug='swedish';
INSERT INTO service_screening (service_id, code, category) SELECT id, 'suspected_blood_clot', 'POSTPONE_OR_REFER' FROM services WHERE slug='swedish';
INSERT INTO service_screening (service_id, code, category) SELECT id, 'unexplained_severe_pain', 'POSTPONE_OR_REFER' FROM services WHERE slug='swedish';
INSERT INTO service_screening (service_id, code, category) SELECT id, 'open_wounds', 'MODIFY_TREATMENT' FROM services WHERE slug='swedish';
INSERT INTO service_screening (service_id, code, category) SELECT id, 'skin_infection', 'MODIFY_TREATMENT' FROM services WHERE slug='swedish';
INSERT INTO service_screening (service_id, code, category) SELECT id, 'recent_surgery', 'CLEARANCE_REQUIRED' FROM services WHERE slug='swedish';
INSERT INTO service_screening (service_id, code, category) SELECT id, 'acute_injury', 'MODIFY_TREATMENT' FROM services WHERE slug='swedish';
INSERT INTO service_screening (service_id, code, category) SELECT id, 'bleeding_disorder', 'MODIFY_TREATMENT' FROM services WHERE slug='swedish';
INSERT INTO service_screening (service_id, code, category) SELECT id, 'anticoagulants', 'MODIFY_TREATMENT' FROM services WHERE slug='swedish';
INSERT INTO service_screening (service_id, code, category) SELECT id, 'reduced_sensation', 'MODIFY_TREATMENT' FROM services WHERE slug='swedish';
INSERT INTO service_screening (service_id, code, category) SELECT id, 'circulatory_concerns', 'CLEARANCE_REQUIRED' FROM services WHERE slug='swedish';
INSERT INTO service_screening (service_id, code, category) SELECT id, 'allergies', 'MODIFY_TREATMENT' FROM services WHERE slug='swedish';

INSERT INTO services (slug, name_en, name_es, summary_en, summary_es, description_en, description_es, expect_en, expect_es, benefits_en, benefits_es, candidates_en, candidates_es, notes_en, notes_es, pressure_options, requires_consents, sort_order) VALUES (
  'deep-tissue', $q$Deep Tissue Massage$q$, $q$Masaje de tejido profundo$q$, $q$Focused, slower work on specific areas of muscle tension and discomfort.$q$, $q$Trabajo más lento y enfocado en zonas específicas de tensión y molestia muscular.$q$, $q$A focused massage using appropriately adjusted techniques to address areas of muscular tension and discomfort. Your therapist works more slowly and with more focus, and always within your comfort.$q$, $q$Un masaje enfocado que utiliza técnicas ajustadas para tratar zonas de tensión y molestia muscular. Su terapeuta trabaja de forma más lenta y concentrada, siempre dentro de su comodidad.$q$,
  $q$["A conversation about the areas that bother you and what makes them better or worse.","Slower strokes and sustained pressure on specific areas.","Deeper work should never be painful. Tell your therapist if anything is too much.","Some people feel mild soreness for a day or two afterward."]$q$::jsonb, $q$["Una conversación sobre las zonas que le molestan y qué las mejora o empeora.","Movimientos más lentos y presión sostenida en zonas específicas.","El trabajo profundo nunca debe ser doloroso. Avise a su terapeuta si algo es demasiado.","Algunas personas sienten una leve molestia durante uno o dos días después."]$q$::jsonb,
  $q$["May help ease focused areas of muscle tension","May improve comfort in areas that feel tight","Attention on the places that bother you most"]$q$::jsonb, $q$["Puede ayudar a aliviar zonas concretas de tensión muscular","Puede mejorar la comodidad en zonas que se sienten rígidas","Atención a las zonas que más le molestan"]$q$::jsonb,
  $q$["People with ongoing tension in specific areas","Clients who prefer firmer pressure"]$q$::jsonb, $q$["Personas con tensión persistente en zonas específicas","Clientes que prefieren una presión más firme"]$q$::jsonb,
  $q$["If you take blood thinners or have a bleeding disorder, your therapist will review your intake before the session and may recommend a lighter massage."]$q$::jsonb, $q$["Si toma anticoagulantes o tiene un trastorno de sangrado, su terapeuta revisará su formulario antes de la sesión y podría recomendarle un masaje más suave."]$q$::jsonb,
  ARRAY['MEDIUM','FIRM']::text[], ARRAY['GENERAL_TREATMENT']::text[], 2);
INSERT INTO service_durations (service_id, minutes, price_cents) SELECT id, 30, 3500 FROM services WHERE slug='deep-tissue';
INSERT INTO service_durations (service_id, minutes, price_cents) SELECT id, 60, 6000 FROM services WHERE slug='deep-tissue';
INSERT INTO service_durations (service_id, minutes, price_cents) SELECT id, 90, 9000 FROM services WHERE slug='deep-tissue';
INSERT INTO service_screening (service_id, code, category) SELECT id, 'fever', 'POSTPONE_OR_REFER' FROM services WHERE slug='deep-tissue';
INSERT INTO service_screening (service_id, code, category) SELECT id, 'contagious_illness', 'POSTPONE_OR_REFER' FROM services WHERE slug='deep-tissue';
INSERT INTO service_screening (service_id, code, category) SELECT id, 'suspected_blood_clot', 'POSTPONE_OR_REFER' FROM services WHERE slug='deep-tissue';
INSERT INTO service_screening (service_id, code, category) SELECT id, 'unexplained_severe_pain', 'POSTPONE_OR_REFER' FROM services WHERE slug='deep-tissue';
INSERT INTO service_screening (service_id, code, category) SELECT id, 'open_wounds', 'MODIFY_TREATMENT' FROM services WHERE slug='deep-tissue';
INSERT INTO service_screening (service_id, code, category) SELECT id, 'skin_infection', 'MODIFY_TREATMENT' FROM services WHERE slug='deep-tissue';
INSERT INTO service_screening (service_id, code, category) SELECT id, 'recent_surgery', 'CLEARANCE_REQUIRED' FROM services WHERE slug='deep-tissue';
INSERT INTO service_screening (service_id, code, category) SELECT id, 'acute_injury', 'MODIFY_TREATMENT' FROM services WHERE slug='deep-tissue';
INSERT INTO service_screening (service_id, code, category) SELECT id, 'reduced_sensation', 'MODIFY_TREATMENT' FROM services WHERE slug='deep-tissue';
INSERT INTO service_screening (service_id, code, category) SELECT id, 'circulatory_concerns', 'CLEARANCE_REQUIRED' FROM services WHERE slug='deep-tissue';
INSERT INTO service_screening (service_id, code, category) SELECT id, 'allergies', 'MODIFY_TREATMENT' FROM services WHERE slug='deep-tissue';
INSERT INTO service_screening (service_id, code, category) SELECT id, 'anticoagulants', 'CLEARANCE_REQUIRED' FROM services WHERE slug='deep-tissue';
INSERT INTO service_screening (service_id, code, category) SELECT id, 'bleeding_disorder', 'CLEARANCE_REQUIRED' FROM services WHERE slug='deep-tissue';
INSERT INTO service_screening (service_id, code, category) SELECT id, 'pregnancy', 'MODIFY_TREATMENT' FROM services WHERE slug='deep-tissue';

INSERT INTO services (slug, name_en, name_es, summary_en, summary_es, description_en, description_es, expect_en, expect_es, benefits_en, benefits_es, candidates_en, candidates_es, notes_en, notes_es, pressure_options, requires_consents, sort_order) VALUES (
  'sports', $q$Sports Massage$q$, $q$Masaje deportivo$q$, $q$Techniques tailored to your activity, your recovery and movement-related tension.$q$, $q$Técnicas adaptadas a su actividad física, su recuperación y la tensión relacionada con el movimiento.$q$, $q$Massage techniques tailored to physical activity, recovery needs and movement-related muscular tension. It suits athletes, regular exercisers and anyone getting back into an active routine.$q$, $q$Técnicas de masaje adaptadas a la actividad física, las necesidades de recuperación y la tensión muscular relacionada con el movimiento. Es adecuado para deportistas, personas que hacen ejercicio con regularidad y quienes retoman una rutina activa.$q$,
  $q$["Questions about your activity, training schedule and the areas you use most.","A mix of techniques such as compression, kneading and stretching.","Pressure that matches your goals, before or after an event.","Comfortable clothing may be used for some stretching work."]$q$::jsonb, $q$["Preguntas sobre su actividad, su rutina de entrenamiento y las zonas que más utiliza.","Una combinación de técnicas como compresión, amasamiento y estiramientos.","Una presión adecuada a sus objetivos, antes o después de una competencia.","Para algunos estiramientos se puede usar ropa cómoda."]$q$::jsonb,
  $q$["May support recovery after activity","May ease tension in muscles you use often","May help you feel more comfortable moving"]$q$::jsonb, $q$["Puede favorecer la recuperación después de la actividad","Puede aliviar la tensión en los músculos que usa con frecuencia","Puede ayudarle a moverse con más comodidad"]$q$::jsonb,
  $q$["Athletes and people who exercise regularly","People returning to physical activity"]$q$::jsonb, $q$["Deportistas y personas que hacen ejercicio con regularidad","Personas que retoman la actividad física"]$q$::jsonb,
  $q$["Recent sports injuries are reviewed by your therapist first. For a new or severe injury, we may ask you to see a medical provider before your session."]$q$::jsonb, $q$["Su terapeuta revisa primero las lesiones deportivas recientes. Ante una lesión nueva o grave, podríamos pedirle que consulte a un profesional médico antes de su sesión."]$q$::jsonb,
  ARRAY['MEDIUM','FIRM']::text[], ARRAY['GENERAL_TREATMENT']::text[], 3);
INSERT INTO service_durations (service_id, minutes, price_cents) SELECT id, 30, 3500 FROM services WHERE slug='sports';
INSERT INTO service_durations (service_id, minutes, price_cents) SELECT id, 60, 6000 FROM services WHERE slug='sports';
INSERT INTO service_durations (service_id, minutes, price_cents) SELECT id, 90, 9000 FROM services WHERE slug='sports';
INSERT INTO service_screening (service_id, code, category) SELECT id, 'fever', 'POSTPONE_OR_REFER' FROM services WHERE slug='sports';
INSERT INTO service_screening (service_id, code, category) SELECT id, 'contagious_illness', 'POSTPONE_OR_REFER' FROM services WHERE slug='sports';
INSERT INTO service_screening (service_id, code, category) SELECT id, 'suspected_blood_clot', 'POSTPONE_OR_REFER' FROM services WHERE slug='sports';
INSERT INTO service_screening (service_id, code, category) SELECT id, 'unexplained_severe_pain', 'POSTPONE_OR_REFER' FROM services WHERE slug='sports';
INSERT INTO service_screening (service_id, code, category) SELECT id, 'open_wounds', 'MODIFY_TREATMENT' FROM services WHERE slug='sports';
INSERT INTO service_screening (service_id, code, category) SELECT id, 'skin_infection', 'MODIFY_TREATMENT' FROM services WHERE slug='sports';
INSERT INTO service_screening (service_id, code, category) SELECT id, 'recent_surgery', 'CLEARANCE_REQUIRED' FROM services WHERE slug='sports';
INSERT INTO service_screening (service_id, code, category) SELECT id, 'acute_injury', 'MODIFY_TREATMENT' FROM services WHERE slug='sports';
INSERT INTO service_screening (service_id, code, category) SELECT id, 'bleeding_disorder', 'MODIFY_TREATMENT' FROM services WHERE slug='sports';
INSERT INTO service_screening (service_id, code, category) SELECT id, 'anticoagulants', 'MODIFY_TREATMENT' FROM services WHERE slug='sports';
INSERT INTO service_screening (service_id, code, category) SELECT id, 'reduced_sensation', 'MODIFY_TREATMENT' FROM services WHERE slug='sports';
INSERT INTO service_screening (service_id, code, category) SELECT id, 'circulatory_concerns', 'CLEARANCE_REQUIRED' FROM services WHERE slug='sports';
INSERT INTO service_screening (service_id, code, category) SELECT id, 'allergies', 'MODIFY_TREATMENT' FROM services WHERE slug='sports';
INSERT INTO service_screening (service_id, code, category) SELECT id, 'pregnancy', 'MODIFY_TREATMENT' FROM services WHERE slug='sports';

INSERT INTO services (slug, name_en, name_es, summary_en, summary_es, description_en, description_es, expect_en, expect_es, benefits_en, benefits_es, candidates_en, candidates_es, notes_en, notes_es, pressure_options, requires_consents, sort_order) VALUES (
  'aromatherapy', $q$Aromatherapy Massage$q$, $q$Masaje con aromaterapia$q$, $q$A relaxing massage with optional aromatherapy, offered after an allergy screening.$q$, $q$Un masaje relajante con aromaterapia opcional, previa evaluación de alergias.$q$, $q$A relaxing massage experience with optional aromatherapy. Before we use any aroma, we screen for allergies and scent sensitivities and ask for your separate consent. Our standard hypoallergenic lotion is used for the massage itself.$q$, $q$Una experiencia de masaje relajante con aromaterapia opcional. Antes de usar cualquier aroma, evaluamos alergias y sensibilidad a los olores y le pedimos un consentimiento por separado. Para el masaje usamos nuestra loción hipoalergénica habitual.$q$,
  $q$["An allergy and scent-sensitivity check before your first aromatherapy session.","A chance to smell the approved aroma before we begin, or to skip it.","A calm, relaxing massage similar to a Swedish massage."]$q$::jsonb, $q$["Una revisión de alergias y sensibilidad a los olores antes de su primera sesión con aromaterapia.","La posibilidad de oler el aroma aprobado antes de comenzar, o de prescindir de él.","Un masaje tranquilo y relajante, similar al masaje sueco."]$q$::jsonb,
  $q$["May help you feel calm and relaxed","May ease everyday muscle tension","A soothing sensory experience, if scents are right for you"]$q$::jsonb, $q$["Puede ayudarle a sentirse en calma y relajado","Puede aliviar la tensión muscular cotidiana","Una experiencia sensorial relajante, si los aromas son adecuados para usted"]$q$::jsonb,
  $q$["Anyone looking for a calming, relaxing session","Clients with no known sensitivity to scents"]$q$::jsonb, $q$["Quien busque una sesión tranquila y relajante","Clientes sin sensibilidad conocida a los aromas"]$q$::jsonb,
  $q$["Aromatherapy requires an allergy screening and a separate signed consent. If aromatherapy isn't right for you, you still receive the relaxing massage without it."]$q$::jsonb, $q$["La aromaterapia requiere una evaluación de alergias y un consentimiento firmado por separado. Si la aromaterapia no es adecuada para usted, recibirá igualmente el masaje relajante sin ella."]$q$::jsonb,
  ARRAY['LIGHT','MEDIUM','FIRM']::text[], ARRAY['GENERAL_TREATMENT','AROMATHERAPY']::text[], 4);
INSERT INTO service_durations (service_id, minutes, price_cents) SELECT id, 30, 3500 FROM services WHERE slug='aromatherapy';
INSERT INTO service_durations (service_id, minutes, price_cents) SELECT id, 60, 5500 FROM services WHERE slug='aromatherapy';
INSERT INTO service_durations (service_id, minutes, price_cents) SELECT id, 90, 8500 FROM services WHERE slug='aromatherapy';
INSERT INTO service_screening (service_id, code, category) SELECT id, 'fever', 'POSTPONE_OR_REFER' FROM services WHERE slug='aromatherapy';
INSERT INTO service_screening (service_id, code, category) SELECT id, 'contagious_illness', 'POSTPONE_OR_REFER' FROM services WHERE slug='aromatherapy';
INSERT INTO service_screening (service_id, code, category) SELECT id, 'suspected_blood_clot', 'POSTPONE_OR_REFER' FROM services WHERE slug='aromatherapy';
INSERT INTO service_screening (service_id, code, category) SELECT id, 'unexplained_severe_pain', 'POSTPONE_OR_REFER' FROM services WHERE slug='aromatherapy';
INSERT INTO service_screening (service_id, code, category) SELECT id, 'open_wounds', 'MODIFY_TREATMENT' FROM services WHERE slug='aromatherapy';
INSERT INTO service_screening (service_id, code, category) SELECT id, 'skin_infection', 'MODIFY_TREATMENT' FROM services WHERE slug='aromatherapy';
INSERT INTO service_screening (service_id, code, category) SELECT id, 'recent_surgery', 'CLEARANCE_REQUIRED' FROM services WHERE slug='aromatherapy';
INSERT INTO service_screening (service_id, code, category) SELECT id, 'acute_injury', 'MODIFY_TREATMENT' FROM services WHERE slug='aromatherapy';
INSERT INTO service_screening (service_id, code, category) SELECT id, 'bleeding_disorder', 'MODIFY_TREATMENT' FROM services WHERE slug='aromatherapy';
INSERT INTO service_screening (service_id, code, category) SELECT id, 'anticoagulants', 'MODIFY_TREATMENT' FROM services WHERE slug='aromatherapy';
INSERT INTO service_screening (service_id, code, category) SELECT id, 'reduced_sensation', 'MODIFY_TREATMENT' FROM services WHERE slug='aromatherapy';
INSERT INTO service_screening (service_id, code, category) SELECT id, 'circulatory_concerns', 'CLEARANCE_REQUIRED' FROM services WHERE slug='aromatherapy';
INSERT INTO service_screening (service_id, code, category) SELECT id, 'allergies', 'MODIFY_TREATMENT' FROM services WHERE slug='aromatherapy';
INSERT INTO service_screening (service_id, code, category) SELECT id, 'scent_sensitivity', 'MODIFY_TREATMENT' FROM services WHERE slug='aromatherapy';
INSERT INTO service_screening (service_id, code, category) SELECT id, 'essential_oil_allergy', 'MODIFY_TREATMENT' FROM services WHERE slug='aromatherapy';
INSERT INTO service_screening (service_id, code, category) SELECT id, 'pregnancy', 'CLEARANCE_REQUIRED' FROM services WHERE slug='aromatherapy';

INSERT INTO services (slug, name_en, name_es, summary_en, summary_es, description_en, description_es, expect_en, expect_es, benefits_en, benefits_es, candidates_en, candidates_es, notes_en, notes_es, pressure_options, requires_consents, sort_order) VALUES (
  'prenatal', $q$Prenatal Massage$q$, $q$Masaje prenatal$q$, $q$Pregnancy-adapted massage with supportive positioning and individual screening.$q$, $q$Masaje adaptado al embarazo, con posiciones de apoyo y una evaluación individual.$q$, $q$A pregnancy-adapted massage using appropriate positioning, techniques and individualized screening. Your comfort and safety guide every part of the session.$q$, $q$Un masaje adaptado al embarazo, con posiciones, técnicas y una evaluación individual apropiadas. Su comodidad y su seguridad guían cada parte de la sesión.$q$,
  $q$["A prenatal intake that covers how far along you are and any pregnancy concerns.","Side-lying or supported positions with pillows. You won't lie flat on your stomach.","Gentle, adjusted pressure and frequent comfort check-ins."]$q$::jsonb, $q$["Un formulario prenatal sobre las semanas de embarazo y cualquier inquietud relacionada.","Posiciones de lado o con apoyo de almohadas. No se acostará boca abajo.","Presión suave y ajustada, con preguntas frecuentes sobre su comodidad."]$q$::jsonb,
  $q$["May help ease everyday aches of pregnancy","May help you relax and rest more comfortably","Time set aside for your own comfort"]$q$::jsonb, $q$["Puede ayudar a aliviar las molestias cotidianas del embarazo","Puede ayudarle a relajarse y descansar con más comodidad","Un tiempo dedicado a su propio bienestar"]$q$::jsonb,
  $q$["Expectant mothers with an uncomplicated pregnancy","Clients cleared by their provider, if their pregnancy is high-risk"]$q$::jsonb, $q$["Futuras madres con un embarazo sin complicaciones","Clientas con autorización de su médico, si su embarazo es de alto riesgo"]$q$::jsonb,
  $q$["If your pregnancy is high-risk or you have complications, we ask for clearance from your healthcare provider before your session."]$q$::jsonb, $q$["Si su embarazo es de alto riesgo o tiene complicaciones, le pediremos la autorización de su proveedor de salud antes de la sesión."]$q$::jsonb,
  ARRAY['LIGHT','MEDIUM']::text[], ARRAY['GENERAL_TREATMENT','PRENATAL']::text[], 5);
INSERT INTO service_durations (service_id, minutes, price_cents) SELECT id, 30, 4000 FROM services WHERE slug='prenatal';
INSERT INTO service_durations (service_id, minutes, price_cents) SELECT id, 60, 5500 FROM services WHERE slug='prenatal';
INSERT INTO service_durations (service_id, minutes, price_cents) SELECT id, 90, 9000 FROM services WHERE slug='prenatal';
INSERT INTO service_screening (service_id, code, category) SELECT id, 'fever', 'POSTPONE_OR_REFER' FROM services WHERE slug='prenatal';
INSERT INTO service_screening (service_id, code, category) SELECT id, 'contagious_illness', 'POSTPONE_OR_REFER' FROM services WHERE slug='prenatal';
INSERT INTO service_screening (service_id, code, category) SELECT id, 'suspected_blood_clot', 'POSTPONE_OR_REFER' FROM services WHERE slug='prenatal';
INSERT INTO service_screening (service_id, code, category) SELECT id, 'unexplained_severe_pain', 'POSTPONE_OR_REFER' FROM services WHERE slug='prenatal';
INSERT INTO service_screening (service_id, code, category) SELECT id, 'open_wounds', 'MODIFY_TREATMENT' FROM services WHERE slug='prenatal';
INSERT INTO service_screening (service_id, code, category) SELECT id, 'skin_infection', 'MODIFY_TREATMENT' FROM services WHERE slug='prenatal';
INSERT INTO service_screening (service_id, code, category) SELECT id, 'recent_surgery', 'CLEARANCE_REQUIRED' FROM services WHERE slug='prenatal';
INSERT INTO service_screening (service_id, code, category) SELECT id, 'acute_injury', 'MODIFY_TREATMENT' FROM services WHERE slug='prenatal';
INSERT INTO service_screening (service_id, code, category) SELECT id, 'bleeding_disorder', 'MODIFY_TREATMENT' FROM services WHERE slug='prenatal';
INSERT INTO service_screening (service_id, code, category) SELECT id, 'anticoagulants', 'MODIFY_TREATMENT' FROM services WHERE slug='prenatal';
INSERT INTO service_screening (service_id, code, category) SELECT id, 'reduced_sensation', 'MODIFY_TREATMENT' FROM services WHERE slug='prenatal';
INSERT INTO service_screening (service_id, code, category) SELECT id, 'circulatory_concerns', 'CLEARANCE_REQUIRED' FROM services WHERE slug='prenatal';
INSERT INTO service_screening (service_id, code, category) SELECT id, 'allergies', 'MODIFY_TREATMENT' FROM services WHERE slug='prenatal';
INSERT INTO service_screening (service_id, code, category) SELECT id, 'pregnancy_warning_signs', 'POSTPONE_OR_REFER' FROM services WHERE slug='prenatal';
INSERT INTO service_screening (service_id, code, category) SELECT id, 'high_risk_pregnancy', 'CLEARANCE_REQUIRED' FROM services WHERE slug='prenatal';

INSERT INTO enhancements (slug, name_en, name_es, description_en, description_es, benefits_en, benefits_es, requirements_en, requirements_es, added_minutes, price_cents, requires_consents, requires_qualification, sort_order) VALUES (
  'face-massage', $q$Face Massage$q$, $q$Masaje facial$q$, $q$Gentle facial massage intended to encourage relaxation and reduce facial muscle tension.$q$, $q$Masaje facial suave para favorecer la relajación y reducir la tensión de los músculos del rostro.$q$, $q$["May help ease tension in the face and jaw","A calm, relaxing finish to your session"]$q$::jsonb, $q$["Puede ayudar a aliviar la tensión del rostro y la mandíbula","Un cierre tranquilo y relajante para su sesión"]$q$::jsonb,
  $q$[]$q$::jsonb, $q$[]$q$::jsonb, NULL, NULL, ARRAY[]::text[], false, 1);
INSERT INTO enhancement_screening (enhancement_id, code, category) SELECT id, 'skin_infection', 'MODIFY_TREATMENT' FROM enhancements WHERE slug='face-massage';
INSERT INTO enhancement_screening (enhancement_id, code, category) SELECT id, 'open_wounds', 'MODIFY_TREATMENT' FROM enhancements WHERE slug='face-massage';
INSERT INTO enhancement_screening (enhancement_id, code, category) SELECT id, 'recent_cosmetic_procedure', 'POSTPONE_OR_REFER' FROM enhancements WHERE slug='face-massage';
INSERT INTO enhancement_screening (enhancement_id, code, category) SELECT id, 'facial_inflammation', 'MODIFY_TREATMENT' FROM enhancements WHERE slug='face-massage';
INSERT INTO enhancement_screening (enhancement_id, code, category) SELECT id, 'other_facial_condition', 'MODIFY_TREATMENT' FROM enhancements WHERE slug='face-massage';

INSERT INTO enhancements (slug, name_en, name_es, description_en, description_es, benefits_en, benefits_es, requirements_en, requirements_es, added_minutes, price_cents, requires_consents, requires_qualification, sort_order) VALUES (
  'foot-scrub', $q$Foot Scrub with Exfoliating Glove$q$, $q$Exfoliación de pies con guante$q$, $q$Gentle foot exfoliation with an exfoliating glove, followed by our hypoallergenic lotion when suitable.$q$, $q$Exfoliación suave de los pies con un guante exfoliante, seguida de nuestra loción hipoalergénica cuando sea adecuado.$q$, $q$["Leaves feet feeling smoother and refreshed","A soothing addition after time on your feet"]$q$::jsonb, $q$["Deja los pies más suaves y renovados","Un complemento reconfortante después de estar mucho tiempo de pie"]$q$::jsonb,
  $q$[]$q$::jsonb, $q$[]$q$::jsonb, NULL, NULL, ARRAY[]::text[], false, 2);
INSERT INTO enhancement_screening (enhancement_id, code, category) SELECT id, 'open_wounds', 'MODIFY_TREATMENT' FROM enhancements WHERE slug='foot-scrub';
INSERT INTO enhancement_screening (enhancement_id, code, category) SELECT id, 'skin_infection', 'MODIFY_TREATMENT' FROM enhancements WHERE slug='foot-scrub';
INSERT INTO enhancement_screening (enhancement_id, code, category) SELECT id, 'foot_irritation', 'MODIFY_TREATMENT' FROM enhancements WHERE slug='foot-scrub';
INSERT INTO enhancement_screening (enhancement_id, code, category) SELECT id, 'reduced_sensation', 'CLEARANCE_REQUIRED' FROM enhancements WHERE slug='foot-scrub';
INSERT INTO enhancement_screening (enhancement_id, code, category) SELECT id, 'circulatory_concerns', 'CLEARANCE_REQUIRED' FROM enhancements WHERE slug='foot-scrub';
INSERT INTO enhancement_screening (enhancement_id, code, category) SELECT id, 'allergies', 'MODIFY_TREATMENT' FROM enhancements WHERE slug='foot-scrub';

INSERT INTO enhancements (slug, name_en, name_es, description_en, description_es, benefits_en, benefits_es, requirements_en, requirements_es, added_minutes, price_cents, requires_consents, requires_qualification, sort_order) VALUES (
  'dynamic-cupping', $q$Dynamic Cupping$q$, $q$Ventosas dinámicas$q$, $q$A specialized technique that moves suction cups in a controlled way over suitable soft-tissue areas. It can leave temporary marks or bruising on the skin.$q$, $q$Una técnica especializada que desliza ventosas de forma controlada sobre zonas adecuadas de tejido blando. Puede dejar marcas temporales o moretones en la piel.$q$, $q$["May help areas of muscle tension feel looser","Adds a different technique to your therapist's options"]$q$::jsonb, $q$["Puede ayudar a que las zonas de tensión muscular se sientan más sueltas","Agrega otra técnica a las opciones de su terapeuta"]$q$::jsonb,
  $q$["Separate signed consent for cupping","Performed only by a therapist qualified in cupping","Your therapist explains possible bruising or temporary skin marks first","Treatment areas are recorded in your session notes"]$q$::jsonb, $q$["Consentimiento firmado por separado para las ventosas","Solo lo realiza un terapeuta capacitado en ventosas","Su terapeuta le explica primero los posibles moretones o marcas temporales en la piel","Las zonas tratadas se registran en las notas de su sesión"]$q$::jsonb, NULL, NULL, ARRAY['DYNAMIC_CUPPING']::text[], true, 3);
INSERT INTO enhancement_screening (enhancement_id, code, category) SELECT id, 'fragile_skin', 'POSTPONE_OR_REFER' FROM enhancements WHERE slug='dynamic-cupping';
INSERT INTO enhancement_screening (enhancement_id, code, category) SELECT id, 'bleeding_disorder', 'POSTPONE_OR_REFER' FROM enhancements WHERE slug='dynamic-cupping';
INSERT INTO enhancement_screening (enhancement_id, code, category) SELECT id, 'anticoagulants', 'CLEARANCE_REQUIRED' FROM enhancements WHERE slug='dynamic-cupping';
INSERT INTO enhancement_screening (enhancement_id, code, category) SELECT id, 'suspected_blood_clot', 'POSTPONE_OR_REFER' FROM enhancements WHERE slug='dynamic-cupping';
INSERT INTO enhancement_screening (enhancement_id, code, category) SELECT id, 'skin_infection', 'POSTPONE_OR_REFER' FROM enhancements WHERE slug='dynamic-cupping';
INSERT INTO enhancement_screening (enhancement_id, code, category) SELECT id, 'other_clinical_precaution', 'CLEARANCE_REQUIRED' FROM enhancements WHERE slug='dynamic-cupping';

INSERT INTO enhancement_rules (kind, service_id, enhancement_a, reason_en, reason_es)
  SELECT 'SERVICE_BLOCKS_ENHANCEMENT', s.id, e.id, $q$Dynamic cupping is not offered with prenatal massage.$q$, $q$Las ventosas dinámicas no se ofrecen con el masaje prenatal.$q$ FROM services s, enhancements e WHERE s.slug='prenatal' AND e.slug='dynamic-cupping';

-- ─────────────── Consent forms (DRAFT wording — attorney review required) ───────────────
INSERT INTO consent_forms (kind, version, title_en, title_es, body_en, body_es) VALUES
('GENERAL_TREATMENT', 1, $q$Massage therapy consent$q$, $q$Consentimiento para terapia de masaje$q$,
 $q$I am requesting professional, therapeutic massage from a licensed massage therapist at RESTORA Massage Therapy. I understand that massage therapy is not a substitute for medical care, that my therapist does not diagnose conditions or prescribe medication, and that results are not guaranteed. I have given accurate health information and will tell my therapist about any changes. I can ask to change the pressure or stop the session at any time. My therapist may modify, postpone or end a session if it is not safe or if conduct is inappropriate.$q$,
 $q$Solicito masaje profesional y terapéutico de un terapeuta de masaje con licencia en RESTORA Massage Therapy. Entiendo que la terapia de masaje no sustituye la atención médica, que mi terapeuta no diagnostica afecciones ni receta medicamentos, y que no se garantizan resultados. He proporcionado información de salud precisa e informaré a mi terapeuta sobre cualquier cambio. Puedo pedir que se cambie la presión o detener la sesión en cualquier momento. Mi terapeuta puede modificar, posponer o terminar una sesión si no es segura o si la conducta es inapropiada.$q$),
('AROMATHERAPY', 1, $q$Aromatherapy consent$q$, $q$Consentimiento para aromaterapia$q$,
 $q$I agree to the optional use of an aroma approved by RESTORA during my massage. I have disclosed any allergies, asthma, migraines or sensitivity to scents or plants. I understand that essential oils are not added to the standard hypoallergenic lotion, that I can decline or stop aromatherapy at any time, and that I still receive my massage without it.$q$,
 $q$Acepto el uso opcional de un aroma aprobado por RESTORA durante mi masaje. He informado sobre cualquier alergia, asma, migraña o sensibilidad a aromas o plantas. Entiendo que no se agregan aceites esenciales a la loción hipoalergénica habitual, que puedo rechazar o detener la aromaterapia en cualquier momento y que recibiré igualmente mi masaje sin ella.$q$),
('DYNAMIC_CUPPING', 1, $q$Dynamic cupping consent$q$, $q$Consentimiento para ventosas dinámicas$q$,
 $q$I agree to dynamic cupping performed by a therapist qualified in this technique. It has been explained to me that cupping can leave temporary marks, discoloration or bruising on the skin. I have disclosed any bleeding or clotting disorder, use of blood thinners, fragile skin or skin conditions. The areas treated will be recorded in my session notes. I can ask to stop at any time.$q$,
 $q$Acepto la aplicación de ventosas dinámicas por un terapeuta capacitado en esta técnica. Se me ha explicado que las ventosas pueden dejar marcas temporales, cambios de color o moretones en la piel. He informado sobre cualquier trastorno de sangrado o de coagulación, el uso de anticoagulantes, piel frágil o afecciones de la piel. Las zonas tratadas se registrarán en las notas de mi sesión. Puedo pedir que se detenga en cualquier momento.$q$),
('PRENATAL', 1, $q$Prenatal massage consent$q$, $q$Consentimiento para masaje prenatal$q$,
 $q$I am pregnant and request a pregnancy-adapted massage. I have shared how far along I am and any pregnancy complications. If my pregnancy is high-risk, I will provide clearance from my healthcare provider when asked. I will tell my therapist right away about any discomfort, dizziness or other symptoms during the session.$q$,
 $q$Estoy embarazada y solicito un masaje adaptado al embarazo. He indicado las semanas de embarazo y cualquier complicación. Si mi embarazo es de alto riesgo, presentaré la autorización de mi proveedor de salud cuando se me solicite. Informaré de inmediato a mi terapeuta sobre cualquier molestia, mareo u otro síntoma durante la sesión.$q$),
('CANCELLATION_POLICY', 1, $q$Booking and cancellation policy$q$, $q$Política de reservas y cancelaciones$q$,
 $q$I agree to RESTORA's booking policy as shown during booking, including the cancellation and rescheduling window. Appointments with health-screening flags are confirmed only after a therapist reviews them.$q$,
 $q$Acepto la política de reservas de RESTORA que se muestra durante la reserva, incluido el plazo para cancelar y reprogramar. Las citas con alertas en la evaluación de salud se confirman solo después de que un terapeuta las revise.$q$);

-- ─────────────── SOAP templates (prompts only, no client data) ───────────────
INSERT INTO soap_templates (name, body) VALUES
($q$Standard massage session$q$, $q${
  "subjective": "Client-reported concerns, location and description of discomfort, how long it has been present, what makes it better or worse, goals for today, changes since last visit, health-history updates.",
  "objective": "Observations (posture, tissue texture, areas of tension). Areas treated. Techniques used. Pressure used. Session length. Enhancements performed. Products used (standard hypoallergenic lotion unless noted). Client response during the session.",
  "assessment": "Client tolerance of pressure and techniques. Changes observed after treatment. Progress toward stated goals. Limitations or concerns needing follow-up (within LMT scope).",
  "plan": "Recommended focus for the next session. Suggested interval between sessions. Self-care guidance given (stretching, hydration, rest). Referral to a healthcare provider if indicated."
}$q$::jsonb),
($q$Dynamic cupping add-on$q$, $q${
  "subjective": "Client goals for cupping. Consent confirmed. Screening reviewed (skin, bleeding disorders, anticoagulants, clots).",
  "objective": "Exact areas treated with cupping. Cup size and number. Suction level. Duration of moving cupping. Skin response immediately after (marks, redness).",
  "assessment": "Client tolerance. Skin response compared with expectations explained beforehand.",
  "plan": "Aftercare guidance given (marks are temporary). Whether to repeat cupping next session."
}$q$::jsonb);
UPDATE soap_templates SET service_id = NULL;

-- ─────────────── Default settings (editable in Admin → Settings) ───────────────
INSERT INTO settings (key, value) VALUES
('business', $q${
  "phone": null, "email": null, "address": null, "mapUrl": null,
  "area_en": "New Caney and Porter, Texas", "area_es": "New Caney y Porter, Texas",
  "timezone": "America/Chicago",
  "hours": {}
}$q$::jsonb),
('booking', $q${
  "onlineBookingEnabled": true,
  "slotIntervalMinutes": 30,
  "bufferMinutes": 15,
  "minNoticeHours": 12,
  "maxDaysAhead": 60,
  "cancellationWindowHours": 24,
  "rescheduleWindowHours": 24,
  "newClientSameDayAllowed": false
}$q$::jsonb),
('payments', $q${ "mode": "none", "depositPercent": 25, "holdMinutes": 15 }$q$::jsonb),
('content', $q${
  "announcement_en": "", "announcement_es": "",
  "lotion_en": "At RESTORA Massage Therapy, your comfort matters. We use hypoallergenic massage lotion during massage sessions and encourage clients to disclose allergies or skin sensitivities before treatment.",
  "lotion_es": "En RESTORA Massage Therapy, su comodidad es importante. Usamos loción de masaje hipoalergénica durante las sesiones y le pedimos que nos informe sobre cualquier alergia o sensibilidad en la piel antes del tratamiento."
}$q$::jsonb),
('notifications', $q${ "emailEnabled": true, "smsEnabled": false }$q$::jsonb);
