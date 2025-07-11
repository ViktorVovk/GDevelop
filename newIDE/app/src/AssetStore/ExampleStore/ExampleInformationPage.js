// @flow
import { Trans } from '@lingui/macro';
import * as React from 'react';
import { type ExampleShortHeader } from '../../Utils/GDevelopServices/Example';
import { isCompatibleWithGDevelopVersion } from '../../Utils/Extension/ExtensionCompatibilityChecker.js';
import { MarkdownText } from '../../UI/MarkdownText';
import Text from '../../UI/Text';
import AlertMessage from '../../UI/AlertMessage';
import { getIDEVersion } from '../../Version';
import { Column, Line } from '../../UI/Grid';
import { ColumnStackLayout, ResponsiveLineStackLayout } from '../../UI/Layout';
import { ExampleThumbnailOrIcon } from './ExampleThumbnailOrIcon';
import Window from '../../Utils/Window';
import { UserPublicProfileChip } from '../../UI/User/UserPublicProfileChip';
import { ExampleDifficultyChip } from '../../UI/ExampleDifficultyChip';
import { ExampleSizeChip } from '../../UI/ExampleSizeChip';
const isDev = Window.isDev();

const styles = {
  chipsContainer: {
    display: 'flex',
    flexWrap: 'wrap',
  },
};

type Props = {|
  exampleShortHeader: ExampleShortHeader,
|};

export const openExampleInWebApp = (exampleShortHeader: ExampleShortHeader) => {
  Window.openExternalURL(
    `${
      isDev ? 'http://localhost:3000' : 'https://editor.gdevelop.io'
    }/?create-from-example=${exampleShortHeader.slug}`
  );
};

const ExampleInformationPage = ({ exampleShortHeader }: Props) => {
  const isCompatible = isCompatibleWithGDevelopVersion(
    getIDEVersion(),
    exampleShortHeader.gdevelopVersion
  );
  const hasIcon = exampleShortHeader.previewImageUrls.length > 0;

  return (
    <ColumnStackLayout expand noMargin>
      {!isCompatible && (
        <AlertMessage kind="error">
          <Trans>
            Download the latest version of GDevelop to check out this example!
          </Trans>
        </AlertMessage>
      )}
      <ResponsiveLineStackLayout noMargin noResponsiveLandscape>
        {hasIcon ? (
          <Line noMargin>
            <ExampleThumbnailOrIcon exampleShortHeader={exampleShortHeader} />
          </Line>
        ) : null}
        <Column expand>
          <Line>
            <div style={styles.chipsContainer}>
              {exampleShortHeader.difficultyLevel && (
                <ExampleDifficultyChip
                  difficultyLevel={exampleShortHeader.difficultyLevel}
                />
              )}
              {exampleShortHeader.codeSizeLevel && (
                <ExampleSizeChip
                  codeSizeLevel={exampleShortHeader.codeSizeLevel}
                />
              )}
              {exampleShortHeader.authors &&
                exampleShortHeader.authors.map(author => (
                  <UserPublicProfileChip
                    user={author}
                    key={author.id}
                    isClickable
                  />
                ))}
            </div>
          </Line>
          <Line noMargin>
            <Text size="block-title" noMargin>
              {exampleShortHeader.name}
            </Text>
          </Line>
          <Text size="body" displayInlineAsSpan>
            <MarkdownText source={exampleShortHeader.shortDescription} />
          </Text>
          {exampleShortHeader.description && (
            <Text size="body" displayInlineAsSpan>
              <MarkdownText source={exampleShortHeader.description} />
            </Text>
          )}
        </Column>
      </ResponsiveLineStackLayout>
    </ColumnStackLayout>
  );
};

export default ExampleInformationPage;
