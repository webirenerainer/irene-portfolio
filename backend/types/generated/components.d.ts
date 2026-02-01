import type { Schema, Struct } from '@strapi/strapi';

export interface ContentImageSlide extends Struct.ComponentSchema {
  collectionName: 'components_content_image_slides';
  info: {
    description: '';
    displayName: 'Image Slide';
    icon: 'picture';
  };
  attributes: {
    caption: Schema.Attribute.Text;
    image: Schema.Attribute.Media<'images' | 'files' | 'videos' | 'audios'> &
      Schema.Attribute.Required;
  };
}

export interface ContentVideoSlide extends Struct.ComponentSchema {
  collectionName: 'components_content_video_slides';
  info: {
    description: '';
    displayName: 'Video Slide';
    icon: 'play';
  };
  attributes: {
    caption: Schema.Attribute.Text;
    video: Schema.Attribute.Media<'videos' | 'files'> &
      Schema.Attribute.Required;
    vimeoUrl: Schema.Attribute.String;
  };
}

export interface GlobalLiveNews extends Struct.ComponentSchema {
  collectionName: 'components_global_live_news';
  info: {
    description: '';
    displayName: 'Live News';
    icon: 'earth';
  };
  attributes: {
    endDate: Schema.Attribute.Date;
    isActive: Schema.Attribute.Boolean & Schema.Attribute.DefaultTo<true>;
    label: Schema.Attribute.String;
    link: Schema.Attribute.String;
    startDate: Schema.Attribute.Date;
    target: Schema.Attribute.Enumeration<['_self', '_blank']> &
      Schema.Attribute.DefaultTo<'_self'>;
  };
}

export interface SharedCvEntry extends Struct.ComponentSchema {
  collectionName: 'components_shared_cv_entries';
  info: {
    description: '';
    displayName: 'CV Entry';
    icon: 'bulletList';
  };
  attributes: {
    details: Schema.Attribute.RichText;
    info: Schema.Attribute.Text;
    isLive: Schema.Attribute.Boolean & Schema.Attribute.DefaultTo<false>;
    linkTarget: Schema.Attribute.Enumeration<['_blank', '_self']> &
      Schema.Attribute.DefaultTo<'_blank'>;
    linkText: Schema.Attribute.String;
    linkUrl: Schema.Attribute.String;
    liveEndDate: Schema.Attribute.Date;
    liveLabel: Schema.Attribute.String;
    liveStartDate: Schema.Attribute.Date;
    title: Schema.Attribute.String;
    year: Schema.Attribute.String;
  };
}

export interface SharedCvSection extends Struct.ComponentSchema {
  collectionName: 'components_shared_cv_sections';
  info: {
    description: '';
    displayName: 'CV Section';
    icon: 'layer';
  };
  attributes: {
    entries: Schema.Attribute.Component<'shared.cv-entry', true>;
    heading: Schema.Attribute.String & Schema.Attribute.Required;
  };
}

declare module '@strapi/strapi' {
  export module Public {
    export interface ComponentSchemas {
      'content.image-slide': ContentImageSlide;
      'content.video-slide': ContentVideoSlide;
      'global.live-news': GlobalLiveNews;
      'shared.cv-entry': SharedCvEntry;
      'shared.cv-section': SharedCvSection;
    }
  }
}
