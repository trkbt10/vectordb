/**
 * @file Loading screen component
 */
import React from "react";
import { Box, Text } from "ink";
import Spinner from "ink-spinner";

type LoadingScreenProps = { message?: string };

/**
 * LoadingScreen
 * Why: keep user informed while IO-bound operations run.
 */
export function LoadingScreen({ message = "Loading..." }: LoadingScreenProps) {
  return (
    <Box>
      <Text>
        <Spinner type="dots" /> {message}
      </Text>
    </Box>
  );
}

