// @flow
import * as React from 'react';
import SemiControlledTextField, {
  type SemiControlledTextFieldInterface,
} from '../../UI/SemiControlledTextField';
import {
  type ParameterFieldProps,
  type ParameterFieldInterface,
  type FieldFocusFunction,
} from './ParameterFieldCommons';
import { type ParameterInlineRendererProps } from './ParameterInlineRenderer.flow';

export default (React.forwardRef<ParameterFieldProps, ParameterFieldInterface>(
  function DefaultField(props: ParameterFieldProps, ref) {
    const field = React.useRef<?SemiControlledTextFieldInterface>(null);
    const focus: FieldFocusFunction = options => {
      if (field.current) field.current.focus(options);
    };
    React.useImperativeHandle(ref, () => ({
      focus,
    }));

    const { parameterMetadata } = props;
    const description = parameterMetadata
      ? parameterMetadata.getDescription()
      : undefined;

    return (
      <SemiControlledTextField
        margin={props.isInline ? 'none' : 'dense'}
        commitOnBlur
        value={props.value}
        floatingLabelText={description}
        helperMarkdownText={
          parameterMetadata ? parameterMetadata.getLongDescription() : undefined
        }
        onChange={(text: string) => props.onChange(text)}
        ref={field}
        fullWidth
      />
    );
  }
): React.ComponentType<{
  ...ParameterFieldProps,
  +ref?: React.RefSetter<ParameterFieldInterface>,
}>);

const escapeRegExp = (text: string): string =>
  text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

const highlightText = (text: string, searchText: ?string): React.Node => {
  const query = searchText ? searchText.trim() : '';
  if (!query) return text;

  const regex = new RegExp(`(${escapeRegExp(query)})`, 'ig');
  const parts = text.split(regex);
  return parts.map((part, index) =>
    index % 2 === 1 ? (
      <span key={`${part}-${index}`} className="global-search-text-match">
        {part}
      </span>
    ) : (
      <React.Fragment key={`${part}-${index}`}>{part}</React.Fragment>
    )
  );
};

export const renderInlineDefaultField = ({
  value,
  expressionIsValid,
  hasDeprecationWarning,
  parameterMetadata,
  InvalidParameterValue,
  DeprecatedParameterValue,
  MissingParameterValue,
  highlightedSearchText,
}: ParameterInlineRendererProps): string | React.Node => {
  if (!value && !parameterMetadata.isOptional()) {
    return <MissingParameterValue />;
  }
  if (!expressionIsValid) {
    return (
      <InvalidParameterValue>
        {highlightText(value, highlightedSearchText)}
      </InvalidParameterValue>
    );
  }
  if (hasDeprecationWarning) {
    return (
      <DeprecatedParameterValue>
        {highlightText(value, highlightedSearchText)}
      </DeprecatedParameterValue>
    );
  }
  return highlightText(value, highlightedSearchText);
};
