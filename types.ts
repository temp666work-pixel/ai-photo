export interface Scenario {
  outfit: string;
  location: string;
  lighting: string;
  pose: string;
  styleName: string;
}

export interface GenerationPlan {
  physicalDescription: string;
  scenarios: Scenario[];
}

export interface GeneratedImage {
  id: string;
  url: string;
  scenario: Scenario;
}