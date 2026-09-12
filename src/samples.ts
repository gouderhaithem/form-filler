import type { FieldKey, Locale } from './data';

export type FieldSamples = Partial<Record<FieldKey, readonly string[]>>;
const common:FieldSamples = {
  website:['https://studio.example.com','https://garden.example.com','https://shop.example.com','https://portfolio.example.com'],
  password:['Garden-River-27!','Meadow-Sunshine-42!','Willow-Ocean-63!','Harbor-Forest-85!'],
  color:['#5370ce','#75a878','#d99454','#9869ad','#468e99'],
  city:['Washington','Austin','Paris','Algiers'],
  state:['District of Columbia','Texas','Île-de-France','Algiers'],
  postalCode:['20001','78701','75001','16000'],
  country:['United States','France','Algeria'],
  nationality:['American','French','Algerian'],
  gender:['Female','Male','Prefer not to say'],
};
const localized:Record<Locale,FieldSamples> = {
  en:{
    company:['Cedar Studio','Meadow Labs','Willow Works','Harbor Design'],
    jobTitle:['Product designer','Software engineer','Project manager','Support specialist'],
    department:['Design','Engineering','Operations','Customer support'],
    industry:['Technology','Education','Retail','Consulting'],
    address:['18 Willow Lane','42 Garden Street','75 River Road','9 Orchard Avenue'],
    address2:['Suite 12','Apartment 3','Floor 2','Unit 8'],
    bio:['I enjoy designing useful products.','I help teams bring their ideas to life.','I like learning new skills and meeting people.','I work on thoughtful projects with friendly teams.'],
    description:['A simple project for a growing team.','A welcoming space to share new ideas.','A useful service for everyday tasks.','A fresh approach to planning the next release.'],
    message:['Hello, I would like to learn more.','Could you share more details about this project?','Thank you for your help with this request.','I would be happy to discuss the next steps.'],
    subject:['Project enquiry','Request for information','Meeting availability','Product feedback'],
    notes:['Please contact me in the morning.','The team is ready to review the proposal.','We can discuss the details at our next meeting.','Please send a copy of the updated schedule.'],
    search:['design ideas','garden tools','local workshops','new books'],
    title:['Meadow project','Harbor launch','Garden workshop','Willow collection'],
  },
  fr:{
    company:['Atelier du Cèdre','Studio Horizon','Maison des Idées','Jardin Créatif'],
    jobTitle:['Designer produit','Ingénieur logiciel','Chef de projet','Chargé de clientèle'],
    department:['Création','Informatique','Opérations','Service client'],
    industry:['Technologie','Éducation','Commerce','Conseil'],
    address:['18 rue des Lilas','42 avenue du Jardin','75 rue de la Rivière','9 place des Oliviers'],
    address2:['Appartement 12','Bâtiment 3','Étage 2','Bureau 8'],
    bio:['Je conçois des produits utiles au quotidien.','Je travaille en équipe sur de nouveaux projets.','Je souhaite apprendre et partager mes idées.','Je participe à des initiatives créatives.'],
    description:['Un projet simple pour une équipe motivée.','Un espace convivial pour partager des idées.','Un service pratique pour les tâches du quotidien.','Une nouvelle approche pour préparer le lancement.'],
    message:['Bonjour, je souhaite en savoir plus.','Pourriez-vous partager les détails du projet ?','Merci pour votre aide avec cette demande.','Je suis disponible pour discuter de la suite.'],
    subject:['Demande de renseignements','Disponibilité pour une réunion','Présentation du projet','Retour sur le produit'],
    notes:['Merci de me contacter le matin.','Notre équipe peut examiner la proposition.','Nous pouvons en parler lors de la prochaine réunion.','Merci de transmettre le planning mis à jour.'],
    search:['idées de création','outils de jardin','ateliers locaux','nouveaux livres'],
    title:['Projet Horizon','Atelier du Jardin','Collection Printemps','Rencontre Créative'],
  },
  ar:{
    company:['استوديو الأرز','مختبر الأفكار','ورشة الزيتون','دار الإبداع'],
    jobTitle:['مصمم منتجات','مهندس برمجيات','مدير مشروع','مسؤول خدمة العملاء'],
    department:['التصميم','الهندسة','العمليات','خدمة العملاء'],
    industry:['التكنولوجيا','التعليم','التجارة','الاستشارات'],
    address:['18 شارع الياسمين','42 شارع الحديقة','75 طريق النهر','9 ساحة الزيتون'],
    address2:['شقة 12','مبنى 3','طابق 2','مكتب 8'],
    bio:['أحب تصميم منتجات مفيدة للناس.','أعمل مع فريق على أفكار جديدة.','أستمتع بالتعلم ومشاركة المعرفة.','أشارك في مشاريع إبداعية متنوعة.'],
    description:['مشروع بسيط لفريق متعاون.','مساحة مريحة لتبادل الأفكار.','خدمة مفيدة للمهام اليومية.','طريقة جديدة للتحضير للإطلاق.'],
    message:['مرحبا، أود معرفة المزيد.','هل يمكن مشاركة تفاصيل المشروع؟','شكرا لمساعدتكم في هذا الطلب.','يسعدني مناقشة الخطوات المقبلة.'],
    subject:['طلب معلومات','موعد اجتماع','عرض المشروع','ملاحظات حول المنتج'],
    notes:['يرجى التواصل معي في الصباح.','الفريق مستعد لمراجعة المقترح.','يمكن مناقشة التفاصيل في الاجتماع المقبل.','يرجى إرسال نسخة من الجدول الجديد.'],
    search:['أفكار التصميم','أدوات الحديقة','ورشات محلية','كتب جديدة'],
    title:['مشروع الأفق','ورشة الحديقة','مجموعة الربيع','لقاء الإبداع'],
  },
};
export function generateSamples(locale:Locale):FieldSamples {
  return {...common,...localized[locale]};
}
