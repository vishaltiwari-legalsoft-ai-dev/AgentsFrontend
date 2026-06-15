"use client";

import { Icon, Badge, Button, IconButton } from "@/lib/kit-ui";
import type { AgentSettingsConfig, AgentSettingsValues } from "@/lib/agent-settings";

function SettingToggle({
  id,
  name,
  description,
  checked,
  disabled,
  onChange,
}: {
  id: string;
  name: string;
  description: string;
  checked: boolean;
  disabled?: boolean;
  onChange: (on: boolean) => void;
}) {
  return (
    <label className="twsetting-toggle" htmlFor={id}>
      <input
        id={id}
        type="checkbox"
        checked={checked}
        disabled={disabled}
        onChange={(e) => onChange(e.target.checked)}
      />
      <span className="twsetting-toggle__track" aria-hidden />
      <span className="twsetting-toggle__body">
        <span className="twsetting-toggle__name">{name}</span>
        <span className="twsetting-toggle__desc">{description}</span>
      </span>
    </label>
  );
}

export function AgentSettingsPanel({
  config,
  values,
  onChange,
  onNewConversation,
  onClose,
}: {
  config: AgentSettingsConfig;
  values: AgentSettingsValues;
  onChange: (next: AgentSettingsValues) => void;
  onNewConversation: () => void;
  onClose?: () => void;
}) {
  const selectedModel = config.image_models.find((m) => m.id === values.image_model);

  return (
    <div className="twsettings">
      <div className="twsettings__head">
        <div className="twsettings__title">
          <Icon name="settings-2" size={16} />
          <span>Agent settings</span>
        </div>
        {onClose ? (
          <IconButton label="Close settings" variant="ghost" size="sm" onClick={onClose}>
            <Icon name="x" size={16} />
          </IconButton>
        ) : null}
      </div>

      <div className="twsettings__scroll">
        <section className="twsettings__section">
          <div className="twsettings__label">Image model</div>
          <p className="twsettings__hint">The agent uses this model when generating creatives.</p>
          <div className="twsettings__models">
            {config.image_models.map((model) => {
              const active = values.image_model === model.id;
              return (
                <button
                  key={model.id}
                  type="button"
                  className="twmodel"
                  data-active={active ? "1" : "0"}
                  onClick={() => onChange({ ...values, image_model: model.id })}
                >
                  <div className="twmodel__top">
                    <span className="twmodel__name">{model.name}</span>
                    {model.recommended ? <Badge variant="brand">Recommended</Badge> : null}
                  </div>
                  <div className="twmodel__provider">{model.provider}</div>
                  <div className="twmodel__desc">{model.description}</div>
                </button>
              );
            })}
          </div>
        </section>

        <section className="twsettings__section">
          <div className="twsettings__label">Abilities</div>
          <div className="twsettings__stack">
            {config.abilities.map((ability) => (
              <SettingToggle
                key={ability.id}
                id={`ability-${ability.id}`}
                name={ability.name}
                description={ability.description}
                checked={values.enabled_abilities.includes(ability.id)}
                disabled={ability.id === "generate_creatives"}
                onChange={(on) =>
                  onChange({
                    ...values,
                    enabled_abilities: on
                      ? [...values.enabled_abilities, ability.id]
                      : values.enabled_abilities.filter((id) => id !== ability.id),
                  })
                }
              />
            ))}
          </div>
        </section>

        <section className="twsettings__section">
          <div className="twsettings__label">Tools</div>
          <div className="twsettings__stack">
            {config.tools.map((tool) => (
              <SettingToggle
                key={tool.id}
                id={`tool-${tool.id}`}
                name={tool.name}
                description={tool.description}
                checked={values.enabled_tools.includes(tool.id)}
                onChange={(on) =>
                  onChange({
                    ...values,
                    enabled_tools: on
                      ? [...values.enabled_tools, tool.id]
                      : values.enabled_tools.filter((id) => id !== tool.id),
                  })
                }
              />
            ))}
          </div>
        </section>
      </div>

      <div className="twsettings__foot">
        {selectedModel ? (
          <div className="twsettings__active">
            <Icon name="sparkles" size={14} />
            <span>
              Using <strong>{selectedModel.name}</strong>
            </span>
          </div>
        ) : null}
        <Button variant="secondary" size="sm" fullWidth iconLeft={<Icon name="plus" size={15} />} onClick={onNewConversation}>
          New conversation
        </Button>
      </div>
    </div>
  );
}
