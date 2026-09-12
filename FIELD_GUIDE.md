# Fields, labels, and types

The implemented matcher supports these 42 categories. These are the current built-in aliases, not a promise that every website uses a recognizable label. Custom exact-label rules extend the catalog. HTML autocomplete attributes take priority.

| Field | Typical native control | Recognized label examples |
| --- | --- | --- |
| Username | text | username, user name, login, identifiant, nom utilisateur, nom d utilisateur, اسم المستخدم |
| Full name | text | full name, name, your name, nom complet, nom et prenom, prenom et nom, الاسم الكامل, الاسم واللقب |
| First name | text | first name, firstname, given name, prenom, الاسم الاول, الاسم الشخصي, الاسم |
| Middle name | text | middle name, second prenom, الاسم الاوسط |
| Last name | text | last name, lastname, surname, family name, nom, nom de famille, اللقب, اسم العائلة |
| Email | email / text | email, e mail, email address, courriel, adresse electronique, البريد الالكتروني |
| Phone | tel / text | phone, phone number, telephone, tel, mobile, numero de telephone, الهاتف, رقم الهاتف |
| Password | password (opt-in) | password, confirm password, repeat password, mot de passe, confirmation mot de passe, كلمة المرور, تاكيد كلمة المرور |
| Date of birth | date | date of birth, birth date, birthday, dob, date de naissance, تاريخ الميلاد |
| Age | number / range | age, العمر |
| Gender | select / text | gender, sex, genre, sexe, الجنس |
| Nationality | text | nationality, nationalite, الجنسية |
| Company | text | company, company name, organization, organisation, entreprise, societe, الشركة, اسم الشركة |
| Job title | text | job title, profession, poste, المهنة, المسمي الوظيفي |
| Department | text | department, departement, service, القسم |
| Industry | text | industry, secteur, الصناعة |
| Employee count | number / range | employee count, number of employees, effectif, عدد الموظفين |
| Street address | text | address, street address, address line 1, adresse, adresse postale, العنوان, عنوان الشارع |
| Apartment / suite | text | address line 2, address 2, apartment, suite, complement adresse, appartement, الشقة |
| City | text | city, town, ville, المدينة |
| State / wilaya | select / text | state, province, region, wilaya, الولاية |
| Postal code | text | postal code, postcode, zip, zip code, code postal, الرمز البريدي |
| Country | select / text | country, country name, pays, البلد, الدولة |
| Website | url / text | website, web site, url, site web, الموقع الالكتروني |
| Biography | textarea / text | bio, biography, about me, biographie, نبذة |
| Description | textarea / text | description, details, الوصف, التفاصيل |
| Message | textarea / text | message, comment, commentaire, الرسالة, تعليق |
| Subject | text | subject, sujet, objet, الموضوع |
| Notes | textarea / text | notes, remarques, ملاحظات |
| Quantity | number / range | quantity, qty, quantite, الكمية |
| Price | number / range | price, prix, السعر |
| Amount | number / range | amount, montant, المبلغ |
| Salary | number / range | salary, salaire, الراتب |
| Percentage | number / range | percentage, pourcentage, النسبة |
| Rating | number / range | rating, score, evaluation, التقييم |
| Date | date | date, التاريخ |
| Start date | date | start date, date de debut, تاريخ البداية |
| End date | date | end date, date de fin, تاريخ النهاية |
| Time | time | time, heure, الوقت |
| Color | color | color, colour, couleur, اللون |
| Search | search / text | search, recherche, بحث |
| Title | text | title, titre, العنوان المختصر |

## Generic control coverage

**Fill unknown fields** is enabled by default to populate controls without a recognized label, even if text validation rejects the sample.

- Text and textarea: simple real words for text inputs and short readable sentences for textareas, with a different choice on consecutive clicks.
- Number and range: bounded, step-aligned sample numbers. Existing range values are preserved unless replacement is enabled.
- Date, datetime-local, month, week, time: varying formatted sample values, adjusted for min/max where applicable.
- Color: a sample hex color; the default native value is preserved unless replacement is enabled.
- Native select: a matching semantic option, or an eligible non-placeholder option in generic mode; replacement chooses a different option when possible. Multi-selects receive one option.
- Radio: a different eligible option per named group when possible; existing selection is kept unless replacement is enabled.
- Checkbox: toggle eligible boxes on each replacement in generic mode. Detected consent, subscription, privacy, and terms choices stay manual.

## Additional ideas for later versions

| Area | Suggested additions |
| --- | --- |
| Regional data | Algerian wilayas/communes, French departments, local phone formats, language-independent locale choice |
| Identity | Name prefixes/suffixes, aliases, pronouns, localized nationality choices |
| Business | SKU, product name, order reference, invoice reference, tax fixtures, currency, discount, inventory count |
| Travel | Departure/arrival, destination, booking reference, passenger count, duration |
| Education | School, university, degree, study field, graduation year, student reference |
| Recruiting | Experience years, availability date, skills, portfolio, employment type |
| Technical | UUID, slug, hostname, IP fixtures, semantic version, JSON payload, regular-expression-based strings |
| Testing | Seeded repeatable data, invalid/boundary-value scenarios, per-site presets, import/export |
| Advanced widgets | React/ARIA comboboxes, searchable selects, date-picker widgets, rich text, frames, shadow roots |
| Files and payments | Explicit fixture-file selection and sandbox-only payment fixtures |

These suggestions are not implemented. Custom rules insert the exact configured value without added prefixes or suffixes. Generated defaults use readable words and phrases; they never append random IDs.
